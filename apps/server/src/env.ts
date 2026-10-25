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
 * @returns The settings, or a message when `PORT` is not a valid port number.
 */
export function readServerEnv(
	env: Readonly<Record<string, string | undefined>>,
	root: string,
): Result<ServerEnv, string> {
	const rawPath = env.GLAZE_CONFIG_PATH?.trim() || DEFAULT_CONFIG_PATH;
	const configPath = isAbsolute(rawPath) ? rawPath : resolve(root, rawPath);
	const rawPort = env.PORT?.trim();
	const port = rawPort ? Number(rawPort) : DEFAULT_PORT;
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		return err(`PORT must be a number between 1 and 65535, got "${rawPort}"`);
	}
	return ok({ configPath, port });
}
