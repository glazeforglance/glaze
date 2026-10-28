import { execFile } from "node:child_process";
import { err, ok, type Result } from "@glaze/core";
import bcrypt from "bcryptjs";
import type { GlanceCommand } from "./glance-validate.ts";

/** `bcrypt.DefaultCost` in Go, which `glance password:hash` uses (main.go). */
export const GLANCE_BCRYPT_COST = 10;

/** Glance refuses shorter passwords (main.go, config.go). */
export const MIN_PASSWORD_LENGTH = 6;

// bcrypt only uses the first 72 bytes; refuse longer ones instead of silently cutting them.
const MAX_PASSWORD_BYTES = 72;

const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const TIMEOUT_MS = 15_000;

/** A password hash for Glance's `auth.users.<name>.password-hash`. */
export interface GlancePasswordHash {
	readonly hash: string;
	/** Who made it: Glance itself, or bcryptjs with Glance's cost. */
	readonly via: "glance" | "bcryptjs";
}

/** Why a password couldn't be hashed. */
export interface PasswordHashError {
	readonly code: "too-short" | "too-long";
	/** `{ min }` or `{ max }`, for the web app's sentence. */
	readonly params: Readonly<Record<string, number>>;
	readonly message: string;
}

function runGlanceHash(
	command: GlanceCommand,
	password: string,
): Promise<string | null> {
	return new Promise((resolve) => {
		execFile(
			command.bin,
			[...(command.prefixArgs ?? []), "password:hash", password],
			{
				timeout: command.timeoutMs ?? TIMEOUT_MS,
				windowsHide: true,
				encoding: "utf8",
			},
			// Output is a hash or an error; neither is logged (it relates to a password).
			(error, stdout) => {
				const hash = stdout.trim();
				resolve(!error && BCRYPT_HASH.test(hash) ? hash : null);
			},
		);
	});
}

/**
 * Hashes a password the way `glance password:hash` does: bcrypt with Go's
 * default cost. Uses the Glance binary when there is one (`GLANCE_BIN`), and
 * bcryptjs with the same cost otherwise or when Glance fails. The password
 * is never logged or stored.
 * @param password - The new password.
 * @param glance - How to run Glance, or `null` without a binary.
 * @returns The hash and who made it, or why the password isn't accepted.
 */
export async function hashGlancePassword(
	password: string,
	glance: GlanceCommand | null,
): Promise<Result<GlancePasswordHash, PasswordHashError>> {
	if (password.length < MIN_PASSWORD_LENGTH) {
		return err({
			code: "too-short",
			params: { min: MIN_PASSWORD_LENGTH },
			message: `Glance needs a password of at least ${MIN_PASSWORD_LENGTH} characters`,
		});
	}
	if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
		return err({
			code: "too-long",
			params: { max: MAX_PASSWORD_BYTES },
			message: `A password can be at most ${MAX_PASSWORD_BYTES} bytes (bcrypt ignores the rest)`,
		});
	}
	if (glance) {
		const hash = await runGlanceHash(glance, password);
		if (hash) return ok({ hash, via: "glance" });
	}
	return ok({
		hash: await bcrypt.hash(password, GLANCE_BCRYPT_COST),
		via: "bcryptjs",
	});
}
