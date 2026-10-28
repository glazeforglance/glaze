import { createHash, randomBytes } from "node:crypto";
import * as fs from "node:fs/promises";
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
	/** `{ reason }` for `io-error`: the system's own words. */
	readonly params?: Readonly<Record<string, string | number>>;
	readonly message: string;
}

/** The file system calls `writeFileSafely` uses; replaceable in tests. */
export interface WriteFs {
	writeFile(
		path: string,
		data: string,
		options: { encoding: "utf8"; flag?: string },
	): Promise<void>;
	rename(from: string, to: string): Promise<void>;
	rm(path: string, options: { force: boolean }): Promise<void>;
}

const nodeFs: WriteFs = {
	writeFile: (path, data, options) => fs.writeFile(path, data, options),
	rename: (from, to) => fs.rename(from, to),
	rm: (path, options) => fs.rm(path, options),
};

// rename() can't replace a file that is itself a bind mount (EBUSY), crosses
// devices (EXDEV), or is locked by another program on Windows (EPERM).
const IN_PLACE_FALLBACK = new Set(["EBUSY", "EXDEV", "EPERM"]);

function errorCode(error: unknown): string {
	return error instanceof Error && "code" in error ? String(error.code) : "";
}

function toStoreError(error: unknown, path: string): StoreError {
	if (errorCode(error) === "ENOENT") {
		return { code: "not-found", message: `Config file not found: ${path}` };
	}
	const reason = error instanceof Error ? error.message : String(error);
	return { code: "io-error", params: { reason }, message: reason };
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
		const text = await fs.readFile(path, "utf8");
		return ok({ text, version: hashText(text) });
	} catch (error) {
		return err(toStoreError(error, path));
	}
}

// Writes still running, so a shutdown can wait for them.
const pendingWrites = new Set<Promise<unknown>>();

/**
 * Waits for every `writeFileSafely` call that is still running.
 * Used on shutdown, so a SIGTERM never cuts a write in half.
 * @returns Resolves when no write is pending.
 */
export async function waitForPendingWrites(): Promise<void> {
	while (pendingWrites.size > 0) {
		await Promise.allSettled([...pendingWrites]);
	}
}

async function write(
	path: string,
	text: string,
	files: WriteFs,
): Promise<Result<"renamed" | "in-place", StoreError>> {
	const suffix = randomBytes(6).toString("hex");
	const tempPath = join(dirname(path), `.${basename(path)}.${suffix}.tmp`);
	try {
		// "wx" fails instead of overwriting if the temp name somehow exists.
		await files.writeFile(tempPath, text, { encoding: "utf8", flag: "wx" });
	} catch (error) {
		await files.rm(tempPath, { force: true });
		return err(toStoreError(error, path));
	}
	try {
		await files.rename(tempPath, path);
		return ok("renamed");
	} catch (error) {
		await files.rm(tempPath, { force: true });
		if (!IN_PLACE_FALLBACK.has(errorCode(error))) {
			return err(toStoreError(error, path));
		}
	}
	try {
		// Not atomic, but the only way to change a file that can't be replaced.
		await files.writeFile(path, text, { encoding: "utf8" });
		return ok("in-place");
	} catch (error) {
		return err(toStoreError(error, path));
	}
}

/**
 * Writes a file without Glance ever seeing half of it: the text goes to a
 * temp file in the same folder, which is renamed over the original (atomic
 * within one folder; Glance's watcher handles the rename). When the rename
 * fails with `EBUSY`/`EXDEV`/`EPERM` (a single bind-mounted file, a file
 * locked on Windows), it falls back to writing the file in place.
 * @param path - Absolute path of the file (`glance.yml` or an asset).
 * @param text - New file contents.
 * @param files - File system calls; only replaced in tests.
 * @returns How it was written, or why it failed (the original is then untouched,
 *   except when the in-place fallback itself fails).
 */
export function writeFileSafely(
	path: string,
	text: string,
	files: WriteFs = nodeFs,
): Promise<Result<"renamed" | "in-place", StoreError>> {
	const pending = write(path, text, files);
	pendingWrites.add(pending);
	void pending.finally(() => pendingWrites.delete(pending));
	return pending;
}
