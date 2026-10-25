import { parseConfig, validateLayout } from "@glaze/core";
import { Hono } from "hono";
import { hashText, readConfig, writeConfigAtomic } from "./config-store.ts";

/** What the API needs to know about its environment. */
export interface AppOptions {
	/** Absolute path of the `glance.yml` to read and write. */
	readonly configPath: string;
}

interface PutConfigBody {
	readonly text: string;
	readonly baseVersion: string;
}

function isPutConfigBody(value: unknown): value is PutConfigBody {
	return (
		typeof value === "object" &&
		value !== null &&
		"text" in value &&
		typeof value.text === "string" &&
		"baseVersion" in value &&
		typeof value.baseVersion === "string"
	);
}

/**
 * Creates the Glaze API. Kept separate from `serve()` so tests can call
 * `app.request()` against a temp file without starting a server.
 *
 * - `GET /api/config` → `{ text, version }`
 * - `PUT /api/config` with `{ text, baseVersion }` → `{ version }`;
 *   400 bad body, 422 invalid YAML or layout, 409 file changed since `baseVersion`.
 * @param options - Where the config file lives.
 * @returns The Hono app.
 */
export function createApp(options: AppOptions): Hono {
	const { configPath } = options;
	const app = new Hono();

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
		if (!isPutConfigBody(body)) {
			return c.json(
				{
					error: "bad-request",
					message: "Expected JSON { text: string, baseVersion: string }",
				},
				400,
			);
		}

		// Validate before touching the disk: Glance should never get a config it can't load.
		const parsed = parseConfig(body.text);
		if (!parsed.ok) {
			return c.json({ error: "invalid-yaml", ...parsed.error }, 422);
		}
		const issues = validateLayout(parsed.value);
		if (issues.length > 0) {
			return c.json(
				{
					error: "invalid-layout",
					message: "The layout breaks Glance's rules",
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
		if (currentVersion !== body.baseVersion) {
			return c.json(
				{
					error: "conflict",
					message: "The file changed on disk since it was loaded",
					version: currentVersion,
				},
				409,
			);
		}

		const written = await writeConfigAtomic(configPath, body.text);
		if (!written.ok) {
			return c.json(
				{ error: written.error.code, message: written.error.message },
				500,
			);
		}
		return c.json({ version: hashText(body.text) });
	});

	return app;
}
