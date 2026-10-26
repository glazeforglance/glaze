import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { err, ok, type Result } from "@glaze/core";

/** Absolute path of the repository root (this file lives in `apps/server/src`). */
export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const DEFAULT_CONFIG_PATH = ".dev/glance.yml";
const DEFAULT_PORT = 8090;

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

/**
 * Reads the server settings from environment variables.
 * Relative paths in `GLAZE_CONFIG_PATH` are resolved from `root`, so the
 * server finds the file no matter which folder it was started from.
 * @param env - Environment variables, usually `process.env`.
 * @param root - Directory that relative paths are resolved from.
 * @returns The settings, or a message when `GLAZE_PORT` or `GLANCE_URL` is invalid.
 */
export function readServerEnv(
	env: Readonly<Record<string, string | undefined>>,
	root: string,
): Result<ServerEnv, string> {
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
	return ok({
		configPath,
		port,
		glanceBin: optionalPath(env.GLANCE_BIN, root),
		glanceUrl,
	});
}
