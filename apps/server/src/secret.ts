import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { err, ok, type Result } from "@glaze/core";

/** Shorter secrets are too easy to guess; 32 characters of base64url is 192 bits. */
export const MIN_SECRET_LENGTH = 32;

function errorCode(error: unknown): string {
	return error instanceof Error && "code" in error ? String(error.code) : "";
}

/**
 * Returns the session secret stored in `<configDir>/.glaze/secret`, creating
 * it (random, mode 0600) on first start. Storing it next to the config means
 * sessions survive container restarts without the user setting `GLAZE_SECRET`.
 * @param configDir - Folder of `glance.yml`.
 * @returns The secret, or why it couldn't be read or created.
 */
export async function loadOrCreateSecret(
	configDir: string,
): Promise<Result<string, string>> {
	const folder = join(configDir, ".glaze");
	const file = join(folder, "secret");
	try {
		const existing = (await readFile(file, "utf8")).trim();
		if (existing.length >= MIN_SECRET_LENGTH) return ok(existing);
		return err(`${file} is too short; delete it to generate a new one`);
	} catch (error) {
		if (errorCode(error) !== "ENOENT") {
			return err(`Can't read ${file}: ${errorCode(error) || "unknown error"}`);
		}
	}
	const secret = randomBytes(32).toString("base64url");
	try {
		await mkdir(folder, { recursive: true, mode: 0o700 });
		// "wx": if another process created it in the meantime, don't overwrite theirs.
		await writeFile(file, `${secret}\n`, { mode: 0o600, flag: "wx" });
		return ok(secret);
	} catch (error) {
		if (errorCode(error) === "EEXIST") return loadOrCreateSecret(configDir);
		return err(
			`Can't create ${file}: ${errorCode(error) || "unknown error"}. Set GLAZE_SECRET instead.`,
		);
	}
}
