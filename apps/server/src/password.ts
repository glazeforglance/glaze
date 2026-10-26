import {
	randomBytes,
	type ScryptOptions,
	scrypt,
	timingSafeEqual,
} from "node:crypto";
import { err, ok, type Result } from "@glaze/core";

/** scrypt cost settings, as stored in a password hash. */
export interface ScryptParams {
	/** CPU/memory cost; a power of two. */
	readonly N: number;
	/** Block size. */
	readonly r: number;
	/** Parallelization. */
	readonly p: number;
}

/** A parsed password hash. */
export interface PasswordHash extends ScryptParams {
	readonly salt: Buffer;
	readonly hash: Buffer;
}

/**
 * OWASP's scrypt baseline (N=2^17 needs 128 MiB per login, too much for a
 * small home server); 2^15 with r=8 takes ~32 MiB and roughly 50–100 ms.
 */
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { N: 2 ** 15, r: 8, p: 1 };

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
// v0.1.1+: `scrypt:N:r:p:salt:hash`, base64url without padding. Only
// [A-Za-z0-9_:-], so Docker Compose, .env files and app-store UIs that
// re-serialise YAML (ZimaOS, CasaOS) leave it alone.
const BASE64URL = /^[A-Za-z0-9_-]+$/;
// v0.1.0: `scrypt$N$r$p$salt$hash`, standard base64. Still accepted.
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Explains a hash that lost parts on the way, without echoing it. */
export const MANGLED_HASH_HINT =
	"Looks like `$` signs were removed: Docker Compose treats `$` as a variable. Generate a new hash with `hash-password` (v0.1.1+ hashes contain no `$`).";

function deriveKey(
	password: string,
	salt: Buffer,
	params: ScryptParams,
	length: number,
): Promise<Buffer> {
	const options: ScryptOptions = {
		N: params.N,
		r: params.r,
		p: params.p,
		// Node's default limit (32 MiB) is exactly what N=2^15, r=8 needs, plus a bit.
		maxmem: 256 * params.N * params.r,
	};
	return new Promise((resolve, reject) => {
		scrypt(password.normalize("NFC"), salt, length, options, (error, key) => {
			if (error) reject(error);
			else resolve(key);
		});
	});
}

function inRange(value: number, min: number, max: number): boolean {
	return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Parses a password hash. Two formats are accepted:
 * - `scrypt:<N>:<r>:<p>:<salt>:<hash>` with base64url (no padding), from v0.1.1;
 * - `scrypt$<N>$<r>$<p>$<salt>$<hash>` with standard base64, from v0.1.0.
 *
 * Cost settings are bounded, so a hash can't make the server use gigabytes
 * of memory. Error messages never contain the value itself.
 * @param encoded - The hash, e.g. from `GLAZE_ADMIN_PASSWORD_HASH`.
 * @returns The parsed parts, or a message explaining what's wrong.
 */
export function parsePasswordHash(
	encoded: string,
): Result<PasswordHash, string> {
	const value = encoded.trim();
	const modern = value.startsWith("scrypt:");
	const parts = value.split(modern ? ":" : "$");
	const [scheme, rawN, rawR, rawP, rawSalt = "", rawHash = ""] = parts;
	if (parts.length !== 6 || scheme !== "scrypt") {
		// Compose turns `$name` into "", so an old hash arrives with parts missing.
		if (value.startsWith("scrypt") && parts.length < 6) {
			return err(MANGLED_HASH_HINT);
		}
		return err("expected the format scrypt:N:r:p:salt:hash");
	}
	const N = Number(rawN);
	const r = Number(rawR);
	const p = Number(rawP);
	// N must be a power of two; 2^10…2^20 keeps memory between 1 MiB and 1 GiB at r=8.
	if (!inRange(N, 2 ** 10, 2 ** 20) || (N & (N - 1)) !== 0) {
		return err("N must be a power of two between 1024 and 1048576");
	}
	if (!inRange(r, 1, 32) || !inRange(p, 1, 16)) {
		return err("r must be 1–32 and p 1–16");
	}
	const alphabet = modern ? BASE64URL : BASE64;
	if (!alphabet.test(rawSalt) || !alphabet.test(rawHash)) {
		return err(
			modern
				? "salt and hash must be base64url without padding (A–Z, a–z, 0–9, - and _)"
				: "salt and hash must be base64",
		);
	}
	const encoding = modern ? "base64url" : "base64";
	const salt = Buffer.from(rawSalt, encoding);
	const hash = Buffer.from(rawHash, encoding);
	if (salt.length < 8 || hash.length < 16) {
		return err("salt or hash is too short");
	}
	return ok({ N, r, p, salt, hash });
}

/**
 * Hashes a password with scrypt and a random salt.
 * @param password - The plain-text password.
 * @param params - Cost settings; defaults to `DEFAULT_SCRYPT_PARAMS`.
 * @param salt - Fixed salt; only for deriving a stable hash from `GLAZE_ADMIN_PASSWORD`.
 * @returns The hash as `scrypt:N:r:p:salt:hash` (base64url, no padding).
 */
export async function hashPassword(
	password: string,
	params: ScryptParams = DEFAULT_SCRYPT_PARAMS,
	salt: Buffer = randomBytes(SALT_LENGTH),
): Promise<string> {
	const key = await deriveKey(password, salt, params, KEY_LENGTH);
	return [
		"scrypt",
		params.N,
		params.r,
		params.p,
		salt.toString("base64url"),
		key.toString("base64url"),
	].join(":");
}

/**
 * Checks a password against a parsed hash, in constant time.
 * @param password - The password someone typed.
 * @param stored - The parsed hash to compare with.
 * @returns True when the password matches.
 */
export async function verifyPassword(
	password: string,
	stored: PasswordHash,
): Promise<boolean> {
	const key = await deriveKey(
		password,
		stored.salt,
		stored,
		stored.hash.length,
	);
	return timingSafeEqual(key, stored.hash);
}
