import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Context, Hono } from "hono";
import { CSP_NONCE_KEY } from "./security.ts";

/** Placeholder in `apps/web/index.html`, replaced with each response's CSP nonce. */
export const NONCE_PLACEHOLDER = "__GLAZE_CSP_NONCE__";

// Vite puts content-hashed files in assets/: their URL changes with their content.
const LONG_CACHE = "public, max-age=31536000, immutable";

/**
 * Tells whether a built web app is in `root` (it has an `index.html`).
 * @param root - Folder from `GLAZE_WEB_DIST`.
 * @returns True when the server can serve the UI.
 */
export function hasWebApp(root: string): boolean {
	return existsSync(join(root, "index.html"));
}

/**
 * Serves the built web app from `root`, after all API routes:
 * - files from `serveStatic`, with long caching for hashed `assets/*`
 *   and `no-cache` (revalidate every time) for everything else;
 * - `index.html` for every other GET outside `/api` (the SPA fallback),
 *   with this response's CSP nonce filled in;
 * - a JSON 404 for unknown `/api` routes (only reachable with a session),
 *   and a plain 404 for missing `assets/*` files.
 * @param app - The app; call after the API routes are added.
 * @param root - Absolute path of the web build (`apps/web/dist`).
 */
export function installWebApp(app: Hono, root: string): void {
	let template: Promise<string> | null = null;

	const sendIndex = async (c: Context) => {
		template ??= readFile(join(root, "index.html"), "utf8");
		const nonce = c.get(CSP_NONCE_KEY);
		const html = (await template).replaceAll(
			NONCE_PLACEHOLDER,
			typeof nonce === "string" ? nonce : "",
		);
		c.header("Cache-Control", "no-cache");
		return c.html(html);
	};

	app.all("/api/*", (c) =>
		c.json({ error: "not-found", message: "No such API route" }, 404),
	);
	app.get("/", sendIndex);
	app.get("/index.html", sendIndex);
	// serveStatic's onFound runs after the response exists, so set caching here.
	app.use("*", async (c, next) => {
		await next();
		if (c.res.ok && !c.res.headers.has("Cache-Control")) {
			c.res.headers.set(
				"Cache-Control",
				c.req.path.startsWith("/assets/") ? LONG_CACHE : "no-cache",
			);
		}
	});
	app.use("*", serveStatic({ root }));
	// An old hashed file (after an update) must 404, not turn into HTML.
	app.get("/assets/*", (c) => c.text("Not found", 404));
	app.get("*", sendIndex);
}
