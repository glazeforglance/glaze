import { Hono } from "hono";
import { type AuthConfig, installAuth } from "./auth.ts";
import {
	findReferencedAssets,
	readAsset,
	resolveAssetPath,
	writeAsset,
} from "./assets.ts";
import { hashText, readConfig, writeFileSafely } from "./config-store.ts";
import { hashGlancePassword } from "./glance-password.ts";
import type { GlanceCommand } from "./glance-validate.ts";
import type { RateLimiter } from "./rate-limit.ts";
import { csrfProtection, securityHeaders } from "./security.ts";
import { installWebApp } from "./static.ts";
import { hasErrors, needsConfirmation, validateDraft } from "./validate.ts";

/** What the API needs to know about its environment. */
export interface AppOptions {
	/** Absolute path of the `glance.yml` to read and write. */
	readonly configPath: string;
	/** How to run Glance for validation; `null` or missing turns it off. */
	readonly glance?: GlanceCommand | null;
	/** Where the browser reaches Glance (`GLANCE_URL`), for the preview. */
	readonly glanceUrl?: string | null;
	/** Environment passed to Glance; defaults to `process.env`. */
	readonly env?: Readonly<Record<string, string | undefined>>;
	/**
	 * The admin account. Required on purpose, so no caller can forget it:
	 * `null` turns auth off (`GLAZE_AUTH=off`, refused in production).
	 */
	readonly auth: AuthConfig | null;
	/** `GLAZE_TRUST_PROXY`: believe `X-Forwarded-*` / `CF-Connecting-IP`. */
	readonly trustProxy?: boolean;
	/** Reported by `/api/healthz`. */
	readonly version?: string;
	/** Clock for sessions and the login limit, replaceable in tests. */
	readonly now?: () => number;
	/** Login limiter, replaceable in tests. */
	readonly loginLimiter?: RateLimiter;
	/**
	 * `GLAZE_ASSETS_PATH`: the folder inside Glaze's container that holds the
	 * files Glance serves under `/assets/`. `null` or missing: resolve
	 * `server.assets-path` from the config's folder instead.
	 */
	readonly assetsPath?: string | null;
	/**
	 * Glaze runs in a container, so Glance probably does too: a host/port
	 * change then needs a confirmation (see `validateDraft`).
	 */
	readonly glazeInContainer?: boolean;
	/** Folder of the built web app to serve next to the API; `null` or missing: API only. */
	readonly webDist?: string | null;
}

// A config or draft this large is a mistake, not something to validate.
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

function field(body: unknown, key: string): unknown {
	return typeof body === "object" && body !== null && key in body
		? (body as Record<string, unknown>)[key]
		: undefined;
}

function textOf(body: unknown): string | null {
	const text = field(body, "text");
	return typeof text === "string" &&
		Buffer.byteLength(text, "utf8") <= MAX_TEXT_BYTES
		? text
		: null;
}

/**
 * Creates the Glaze API. Kept separate from `serve()` so tests can call
 * `app.request()` against a temp file without starting a server.
 *
 * Every response gets security headers (CSP); non-GET `/api` requests get a
 * CSRF check. `/api/healthz` and `/api/auth/*` are public, every other
 * `/api/*` route answers 401 without a valid session (see `installAuth`).
 *
 * - `GET /api/healthz` → `{ ok, version }`
 * - `GET /api/config` → `{ text, version }`
 * - `PUT /api/config` with `{ text, baseVersion, force?, confirmed? }` → `{ version, issues }`;
 *   400 bad body, 422 with `{ issues }` when validation finds errors (YAML
 *   errors always, others unless `force: true`) or an issue needs confirming
 *   and `confirmed` isn't true, 409 file changed since `baseVersion`.
 * - `POST /api/validate` with `{ text }` → `{ issues }`
 * - `GET /api/files` → `{ files, unavailable }`: asset files the config references
 * - `GET /api/files/:name` → `{ name, text, version }`
 * - `PUT /api/files/:name` with `{ text, baseVersion }` → `{ version }`; 409 on conflict
 * - `GET /api/settings` → `{ glanceUrl, glanceValidation, glazeInContainer }`
 * - `POST /api/glance/password-hash` with `{ password }` → `{ hash, via }`:
 *   a bcrypt hash for Glance's `auth.users` (400 for a password Glance refuses)
 * - with `webDist`: the web app on every other GET (see `installWebApp`)
 * @param options - Where the config file lives and how to reach Glance.
 * @returns The Hono app.
 */
export function createApp(options: AppOptions): Hono {
	const { configPath } = options;
	const glance = options.glance ?? null;
	const trustProxy = options.trustProxy ?? false;
	const assetsPath = options.assetsPath ?? null;
	const glazeInContainer = options.glazeInContainer ?? false;
	/** Validates a draft against the file on disk (`publishedText`). */
	const validate = (text: string, publishedText: string | null) =>
		validateDraft(text, {
			configPath,
			glance,
			...(options.env ? { env: options.env } : {}),
			assetsPath,
			publishedText,
			glazeInContainer,
			glanceUrl: options.glanceUrl ?? null,
		});
	const publishedText = async () => {
		const file = await readConfig(configPath);
		return file.ok ? file.value.text : null;
	};
	const app = new Hono();

	app.use("*", securityHeaders(options.glanceUrl ?? null));
	app.use("/api/*", csrfProtection(trustProxy));

	app.get("/api/healthz", (c) =>
		c.json({ ok: true, version: options.version ?? "dev" }),
	);

	installAuth(app, {
		auth: options.auth,
		trustProxy,
		...(options.now ? { now: options.now } : {}),
		...(options.loginLimiter ? { loginLimiter: options.loginLimiter } : {}),
	});

	app.get("/api/config", async (c) => {
		const file = await readConfig(configPath);
		if (!file.ok) {
			const status = file.error.code === "not-found" ? 404 : 500;
			return c.json(
				{ error: file.error.code, message: file.error.message },
				status,
			);
		}
		return c.json(file.value);
	});

	app.put("/api/config", async (c) => {
		const body: unknown = await c.req.json().catch(() => null);
		const text = textOf(body);
		const baseVersion = field(body, "baseVersion");
		const force = field(body, "force") === true;
		const confirmed = field(body, "confirmed") === true;
		if (text === null || typeof baseVersion !== "string") {
			return c.json(
				{
					error: "bad-request",
					message:
						"Expected JSON { text: string, baseVersion: string, force?: boolean, confirmed?: boolean }",
				},
				400,
			);
		}

		// Validate before touching the disk: Glance should never get a config it can't load.
		const issues = await validate(text, await publishedText());
		// Broken YAML can't be forced: neither Glance nor Glaze could load it again.
		const yamlBroken = issues.some((issue) => issue.source === "yaml");
		if (hasErrors(issues) && (!force || yamlBroken)) {
			return c.json(
				{
					error: "invalid",
					message: yamlBroken
						? "The YAML has errors"
						: "Glance can't use this config",
					issues,
				},
				422,
			);
		}
		// E.g. a port change behind a Docker port mapping: never written by accident.
		if (needsConfirmation(issues) && !confirmed) {
			return c.json(
				{
					error: "unconfirmed",
					message: "This change needs a confirmation",
					issues,
				},
				422,
			);
		}

		// Someone may have edited the file by hand since the editor loaded it.
		const current = await readConfig(configPath);
		if (!current.ok && current.error.code === "io-error") {
			return c.json(
				{ error: current.error.code, message: current.error.message },
				500,
			);
		}
		const currentVersion = current.ok ? current.value.version : null;
		if (currentVersion !== baseVersion) {
			return c.json(
				{
					error: "conflict",
					message: "The file changed on disk since it was loaded",
					version: currentVersion,
				},
				409,
			);
		}

		const written = await writeFileSafely(configPath, text);
		if (!written.ok) {
			return c.json(
				{ error: written.error.code, message: written.error.message },
				500,
			);
		}
		return c.json({ version: hashText(text), issues });
	});

	app.post("/api/validate", async (c) => {
		const body: unknown = await c.req.json().catch(() => null);
		const text = textOf(body);
		if (text === null) {
			return c.json(
				{ error: "bad-request", message: "Expected JSON { text: string }" },
				400,
			);
		}
		return c.json({ issues: await validate(text, await publishedText()) });
	});

	app.get("/api/files", async (c) => {
		const config = await readConfig(configPath);
		if (!config.ok) return c.json({ files: [], unavailable: null });
		const checked = findReferencedAssets(config.value.text).map((entry) => ({
			entry,
			path: resolveAssetPath(
				configPath,
				config.value.text,
				entry.name,
				assetsPath,
			),
		}));
		const refused = checked.find(({ path }) => !path.ok)?.path;
		return c.json({
			files: checked.filter(({ path }) => path.ok).map(({ entry }) => entry),
			// Explains why referenced files can't be edited, e.g. an assets path outside the config folder.
			unavailable: refused && !refused.ok ? refused.error.message : null,
		});
	});

	/** Resolves `:name`, refusing anything that isn't a referenced asset. */
	const assetPath = async (rawPath: string, name: string) => {
		// Encoded slashes or backslashes are never part of a real asset name.
		if (/%2f|%5c/i.test(rawPath)) {
			return {
				ok: false as const,
				status: 400 as const,
				message: "Invalid file name",
			};
		}
		const config = await readConfig(configPath);
		if (!config.ok) {
			return {
				ok: false as const,
				status: 404 as const,
				message: config.error.message,
			};
		}
		const resolved = resolveAssetPath(
			configPath,
			config.value.text,
			name,
			assetsPath,
		);
		if (!resolved.ok) {
			const status = resolved.error.code === "invalid-name" ? 400 : 404;
			return {
				ok: false as const,
				status: status as 400 | 404,
				message: resolved.error.message,
			};
		}
		return { ok: true as const, path: resolved.value };
	};

	app.get("/api/files/:name{.+}", async (c) => {
		const name = c.req.param("name");
		const resolved = await assetPath(c.req.path, name);
		if (!resolved.ok) {
			return c.json(
				{ error: "invalid-file", message: resolved.message },
				resolved.status,
			);
		}
		const file = await readAsset(resolved.path, name);
		if (!file.ok) {
			const status = file.error.code === "io-error" ? 500 : 422;
			return c.json(
				{ error: file.error.code, message: file.error.message },
				status,
			);
		}
		return c.json(file.value);
	});

	app.put("/api/files/:name{.+}", async (c) => {
		const name = c.req.param("name");
		const resolved = await assetPath(c.req.path, name);
		if (!resolved.ok) {
			return c.json(
				{ error: "invalid-file", message: resolved.message },
				resolved.status,
			);
		}
		const body: unknown = await c.req.json().catch(() => null);
		const text = field(body, "text");
		const baseVersion = field(body, "baseVersion");
		if (
			typeof text !== "string" ||
			(typeof baseVersion !== "string" && baseVersion !== null)
		) {
			return c.json(
				{
					error: "bad-request",
					message: "Expected JSON { text: string, baseVersion: string | null }",
				},
				400,
			);
		}
		const written = await writeAsset(resolved.path, name, text, baseVersion);
		if (!written.ok) {
			const { code, message } = written.error;
			const status =
				code === "conflict" ? 409 : code === "io-error" ? 500 : 422;
			return c.json({ ...written.error, error: code, message }, status);
		}
		return c.json(written.value);
	});

	app.post("/api/glance/password-hash", async (c) => {
		const body: unknown = await c.req.json().catch(() => null);
		const password = field(body, "password");
		if (typeof password !== "string") {
			return c.json(
				{ error: "bad-request", message: "Expected JSON { password: string }" },
				400,
			);
		}
		const hashed = await hashGlancePassword(password, glance);
		if (!hashed.ok) {
			return c.json(
				{ error: hashed.error.code, message: hashed.error.message },
				400,
			);
		}
		// Never cached: the answer relates to a password.
		c.header("Cache-Control", "no-store");
		return c.json(hashed.value);
	});

	app.get("/api/settings", (c) =>
		// Only what the browser needs; never env values or paths.
		c.json({
			glanceUrl: options.glanceUrl ?? null,
			glanceValidation: glance !== null,
			glazeInContainer,
		}),
	);

	if (options.webDist) installWebApp(app, options.webDist);

	return app;
}
