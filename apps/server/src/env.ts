import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { err, ok, type Result } from "@glaze/core";
import { parsePasswordHash } from "./password.ts";
import { MIN_SECRET_LENGTH } from "./secret.ts";

/**
 * Absolute path of the repository root. This file lives in `apps/server/src`
 * in development and is bundled into `apps/server/dist` for production, so
 * three levels up is the root either way.
 */
export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** The built web app (`apps/web/dist`), relative to `src/` or `dist/` alike. */
export const DEFAULT_WEB_DIST = fileURLToPath(
	new URL("../../web/dist", import.meta.url),
);

const DEFAULT_CONFIG_PATH = ".dev/glance.yml";
const DEFAULT_PORT = 8090;
const DEFAULT_USERNAME = "admin";

const NO_PASSWORD = `No admin password is set. Create a hash with
  pnpm --filter server hash-password        (from a checkout)
  docker run --rm -it ghcr.io/klingesean/glaze hash-password   (Docker)
and set GLAZE_ADMIN_PASSWORD_HASH to it (in .env or your compose file),
or put it in a file and set GLAZE_ADMIN_PASSWORD_HASH_FILE to that file's path.`;

/** How the admin logs in, as configured. */
export type AuthEnv =
	| { readonly mode: "off" }
	| {
			readonly mode: "on";
			readonly username: string;
			/** `GLAZE_ADMIN_PASSWORD_HASH`; wins over `plainPassword` when both are set. */
			readonly passwordHash: string | null;
			/** `GLAZE_ADMIN_PASSWORD`, only used when no hash is set. */
			readonly plainPassword: string | null;
			/** `GLAZE_SECRET`; `null` means "use or create `.glaze/secret`". */
			readonly secret: string | null;
	  };

/** Settings the server needs to start. */
export interface ServerEnv {
	/** Absolute path of the `glance.yml` Glaze edits. */
	readonly configPath: string;
	readonly port: number;
	/**
	 * Optional `GLANCE_BIN`: the Glance binary used for `config:validate`.
	 * Relative paths start at `root`. `null` turns Glance validation off.
	 */
	readonly glanceBin: string | null;
	/**
	 * Optional `GLANCE_URL`: where the browser can reach Glance, for the live
	 * preview (e.g. `http://localhost:8080`). No trailing slash; `null` when unset.
	 */
	readonly glanceUrl: string | null;
	/** Login settings; `mode: "off"` only outside production. */
	readonly auth: AuthEnv;
	/** `GLAZE_TRUST_PROXY=true`: believe `X-Forwarded-*` and `CF-Connecting-IP`. */
	readonly trustProxy: boolean;
	/**
	 * `GLAZE_ASSETS_PATH`: the folder inside Glaze's container with the files
	 * Glance serves under `/assets/`; `null` to use `server.assets-path`.
	 */
	readonly assetsPath: string | null;
	/** Folder with the built web app (`GLAZE_WEB_DIST`). */
	readonly webDist: string;
	/** `NODE_ENV === "production"`. */
	readonly production: boolean;
	/** Things to tell the admin at startup, without any secret values. */
	readonly warnings: readonly string[];
}

/** Reads a file as text; replaceable in tests. */
export type ReadTextFile = (path: string) => string;

const readTextFile: ReadTextFile = (path) => readFileSync(path, "utf8");

/** Secrets that can also come from a file (`<NAME>_FILE`, the Docker secrets convention). */
export const FILE_VARIABLES = [
	"GLAZE_ADMIN_PASSWORD",
	"GLAZE_ADMIN_PASSWORD_HASH",
	"GLAZE_SECRET",
] as const;

function errorCode(error: unknown): string {
	return error instanceof Error && "code" in error
		? String(error.code)
		: "unknown error";
}

/**
 * Replaces each `<NAME>_FILE` from `FILE_VARIABLES` with `<NAME>`, set to the
 * file's contents (trimmed). Lets Docker secrets (`/run/secrets/…`) or any
 * mounted file hold a password, so it never appears in a compose file.
 * Messages name the variable and path, never the contents.
 * @param env - Environment variables.
 * @param root - Directory that relative file paths are resolved from.
 * @param read - Reads a file; only replaced in tests.
 * @returns The environment with the file values filled in, or why a file couldn't be used.
 */
export function resolveFileVariables(
	env: Readonly<Record<string, string | undefined>>,
	root: string,
	read: ReadTextFile = readTextFile,
): Result<Readonly<Record<string, string | undefined>>, string> {
	const resolved: Record<string, string | undefined> = { ...env };
	for (const name of FILE_VARIABLES) {
		const file = env[`${name}_FILE`]?.trim();
		if (!file) continue;
		if (env[name]) {
			return err(`Both ${name} and ${name}_FILE are set. Use one of them.`);
		}
		const path = isAbsolute(file) ? file : resolve(root, file);
		let value: string;
		try {
			value = read(path).trim();
		} catch (error) {
			return err(
				`Can't read ${name}_FILE (${path}): ${errorCode(error)}. Check that the file exists and Glaze may read it.`,
			);
		}
		if (value === "") return err(`${name}_FILE (${path}) is empty.`);
		resolved[name] = value;
	}
	return ok(resolved);
}

/** Turns an optional path setting into an absolute path, or `null` when empty. */
function optionalPath(raw: string | undefined, root: string): string | null {
	const value = raw?.trim();
	if (!value) return null;
	return isAbsolute(value) ? value : resolve(root, value);
}

/**
 * Loads `<root>/.env` into `process.env`, if the file exists.
 * Uses Node's built-in loader, so no `dotenv` dependency is needed.
 * @param root - Directory that holds `.env`.
 * @returns Whether a `.env` file was loaded.
 */
export function loadDotEnv(root: string): boolean {
	try {
		process.loadEnvFile(join(root, ".env"));
		return true;
	} catch (error) {
		// A missing .env is normal; anything else (e.g. a syntax error) should surface.
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return false;
		}
		throw error;
	}
}

function readBoolean(
	name: string,
	raw: string | undefined,
): Result<boolean, string> {
	const value = raw?.trim().toLowerCase();
	if (!value || value === "false") return ok(false);
	if (value === "true") return ok(true);
	return err(`${name} must be "true" or "false", got "${raw}"`);
}

function readAuth(
	env: Readonly<Record<string, string | undefined>>,
	production: boolean,
	warnings: string[],
): Result<AuthEnv, string> {
	const mode = env.GLAZE_AUTH?.trim().toLowerCase() || "on";
	if (mode !== "on" && mode !== "off") {
		return err(`GLAZE_AUTH must be "on" or "off", got "${env.GLAZE_AUTH}"`);
	}
	if (mode === "off") {
		if (production) {
			return err(
				"GLAZE_AUTH=off is not allowed when NODE_ENV=production: anyone who reaches Glaze could change your config. Remove GLAZE_AUTH and set GLAZE_ADMIN_PASSWORD_HASH.",
			);
		}
		warnings.push("Authentication is OFF (GLAZE_AUTH=off). Development only.");
		return ok({ mode: "off" });
	}

	const passwordHash = env.GLAZE_ADMIN_PASSWORD_HASH?.trim() || null;
	// Not trimmed: spaces may be part of a password.
	const plainPassword = env.GLAZE_ADMIN_PASSWORD || null;
	if (passwordHash !== null) {
		const parsed = parsePasswordHash(passwordHash);
		if (!parsed.ok) {
			return err(`GLAZE_ADMIN_PASSWORD_HASH is invalid: ${parsed.error}`);
		}
		if (plainPassword !== null) {
			warnings.push(
				"Both GLAZE_ADMIN_PASSWORD_HASH and GLAZE_ADMIN_PASSWORD are set; using the hash. Remove GLAZE_ADMIN_PASSWORD.",
			);
		}
	} else if (plainPassword !== null) {
		warnings.push(
			"GLAZE_ADMIN_PASSWORD is plain text. Create a hash with `hash-password` and use GLAZE_ADMIN_PASSWORD_HASH instead.",
		);
	} else {
		return err(NO_PASSWORD);
	}

	const secret = env.GLAZE_SECRET?.trim() || null;
	if (secret !== null && secret.length < MIN_SECRET_LENGTH) {
		return err(
			`GLAZE_SECRET must be at least ${MIN_SECRET_LENGTH} characters (try \`openssl rand -base64 32\`), or leave it unset to generate one.`,
		);
	}
	return ok({
		mode: "on",
		username: env.GLAZE_ADMIN_USERNAME?.trim() || DEFAULT_USERNAME,
		passwordHash,
		plainPassword: passwordHash === null ? plainPassword : null,
		secret,
	});
}

/**
 * Reads the server settings from environment variables.
 * Relative paths in `GLAZE_CONFIG_PATH`, `GLANCE_BIN`, `GLAZE_ASSETS_PATH`,
 * `GLAZE_WEB_DIST` and the `_FILE` variables are
 * resolved from `root`, so the server finds them no matter which folder it
 * was started from.
 *
 * The server must refuse to start (an error here) when no admin password is
 * set, when a hash or `GLAZE_SECRET` is malformed, when a secret is set both
 * directly and as `<NAME>_FILE` (or that file can't be read), or when
 * `GLAZE_AUTH=off` is used with `NODE_ENV=production`.
 * @param rawEnv - Environment variables, usually `process.env`.
 * @param root - Directory that relative paths are resolved from.
 * @param read - Reads `_FILE` secrets; only replaced in tests.
 * @returns The settings, or a message explaining what to fix.
 */
export function readServerEnv(
	rawEnv: Readonly<Record<string, string | undefined>>,
	root: string,
	read: ReadTextFile = readTextFile,
): Result<ServerEnv, string> {
	const files = resolveFileVariables(rawEnv, root, read);
	if (!files.ok) return files;
	const env = files.value;
	const rawPath = env.GLAZE_CONFIG_PATH?.trim() || DEFAULT_CONFIG_PATH;
	const configPath = isAbsolute(rawPath) ? rawPath : resolve(root, rawPath);
	const rawPort = env.GLAZE_PORT?.trim();
	const port = rawPort ? Number(rawPort) : DEFAULT_PORT;
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		return err(
			`GLAZE_PORT must be a number between 1 and 65535, got "${rawPort}"`,
		);
	}
	const rawUrl = env.GLANCE_URL?.trim();
	let glanceUrl: string | null = null;
	if (rawUrl) {
		const url = URL.canParse(rawUrl) ? new URL(rawUrl) : null;
		if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
			return err(`GLANCE_URL must be an http(s) URL, got "${rawUrl}"`);
		}
		glanceUrl = rawUrl.replace(/\/+$/, "");
	}
	const trustProxy = readBoolean("GLAZE_TRUST_PROXY", env.GLAZE_TRUST_PROXY);
	if (!trustProxy.ok) return trustProxy;
	const production = env.NODE_ENV === "production";
	const warnings: string[] = [];
	const auth = readAuth(env, production, warnings);
	if (!auth.ok) return auth;
	return ok({
		configPath,
		port,
		glanceBin: optionalPath(env.GLANCE_BIN, root),
		glanceUrl,
		auth: auth.value,
		trustProxy: trustProxy.value,
		assetsPath: optionalPath(env.GLAZE_ASSETS_PATH, root),
		webDist: optionalPath(env.GLAZE_WEB_DIST, root) ?? DEFAULT_WEB_DIST,
		production,
		warnings,
	});
}
