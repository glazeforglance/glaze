import { createHash, randomBytes } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { err, ok, type Result } from "@glaze/core";

/** The config file as the API hands it out. */
export interface ConfigFile {
	readonly text: string;
	/** Content hash; changes whenever the file changes, by Glaze or by hand. */
	readonly version: string;
}

/** Why the config file couldn't be read or written. */
export interface StoreError {
	readonly code: "not-found" | "io-error";
	readonly message: string;
}

function toStoreError(error: unknown, path: string): StoreError {
	const code =
		error instanceof Error && "code" in error ? String(error.code) : "";
	if (code === "ENOENT") {
		return { code: "not-found", message: `Config file not found: ${path}` };
	}
	const reason = error instanceof Error ? error.message : String(error);
	return { code: "io-error", message: reason };
}

/**
 * Computes the version of a config text.
 * @param text - File contents.
 * @returns A SHA-256 hex digest of the UTF-8 bytes.
 */
export function hashText(text: string): string {
	return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Reads the config file and its version.
 * @param path - Absolute path of `glance.yml`.
 * @returns The text and version, or why the file couldn't be read.
 */
export async function readConfig(
	path: string,
): Promise<Result<ConfigFile, StoreError>> {
	try {
		const text = await readFile(path, "utf8");
		return ok({ text, version: hashText(text) });
	} catch (error) {
		return err(toStoreError(error, path));
	}
}

/**
 * Replaces the config file atomically: the text goes to a temp file in the
 * same folder, which is then renamed over the original. Glance watches the
 * file, so it must never see a half-written version; a rename within one
 * folder is atomic, a direct write is not.
 * @param path - Absolute path of `glance.yml`.
 * @param text - New file contents.
 * @returns Nothing on success, or why the write failed (the original is then untouched).
 */
export async function writeConfigAtomic(
	path: string,
	text: string,
): Promise<Result<void, StoreError>> {
	const suffix = randomBytes(6).toString("hex");
	const tempPath = join(dirname(path), `.${basename(path)}.${suffix}.tmp`);
	try {
		// "wx" fails instead of overwriting if the temp name somehow exists.
		await writeFile(tempPath, text, { encoding: "utf8", flag: "wx" });
		await rename(tempPath, path);
		return ok(undefined);
	} catch (error) {
		await rm(tempPath, { force: true });
		return err(toStoreError(error, path));
	}
}
