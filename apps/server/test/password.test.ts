import { describe, expect, it } from "vitest";
import { checkNewPassword } from "../src/hash-password.ts";
import {
	hashPassword,
	MANGLED_HASH_HINT,
	parsePasswordHash,
	verifyPassword,
} from "../src/password.ts";

const FAST = { N: 1024, r: 8, p: 1 };

/** Rewrites a v0.1.1 hash in the v0.1.0 `$` format with standard base64. */
function toOldFormat(hash: string): string {
	const [, N, r, p, salt = "", key = ""] = hash.split(":");
	const b64 = (part: string) =>
		Buffer.from(part, "base64url").toString("base64");
	return ["scrypt", N, r, p, b64(salt), b64(key)].join("$");
}

/** What Docker Compose does to `$name` in a value: replaces it with "" (unset variable). */
function composeInterpolate(value: string): string {
	return value.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, "");
}

describe("hashPassword", () => {
	it("uses the compose-safe format scrypt:N:r:p:salt:hash", async () => {
		const hash = await hashPassword("hunter2-but-longer", FAST);
		expect(hash).toMatch(/^scrypt:1024:8:1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
		// Nothing Compose, a shell or a YAML re-serialiser would touch.
		expect(hash).toMatch(/^[A-Za-z0-9_:-]+$/);
		const parsed = parsePasswordHash(hash);
		expect(parsed.ok && parsed.value.salt.length).toBe(16);
		expect(parsed.ok && parsed.value.hash.length).toBe(32);
	});

	it("uses the default cost when none is given", async () => {
		expect(await hashPassword("x")).toMatch(/^scrypt:32768:8:1:/);
	});

	it("salts every hash differently", async () => {
		const a = await hashPassword("same password", FAST);
		const b = await hashPassword("same password", FAST);
		expect(a).not.toBe(b);
	});

	it("survives Compose interpolation unchanged", async () => {
		const hash = await hashPassword("pw", FAST);
		expect(composeInterpolate(hash)).toBe(hash);
	});
});

describe("verifyPassword", () => {
	it("accepts the right password (new format round-trip)", async () => {
		const parsed = parsePasswordHash(await hashPassword("right one", FAST));
		if (!parsed.ok) throw new Error(parsed.error);
		expect(await verifyPassword("right one", parsed.value)).toBe(true);
	});

	it("rejects a wrong password", async () => {
		const parsed = parsePasswordHash(await hashPassword("right one", FAST));
		if (!parsed.ok) throw new Error(parsed.error);
		expect(await verifyPassword("wrong one", parsed.value)).toBe(false);
		expect(await verifyPassword("", parsed.value)).toBe(false);
		expect(await verifyPassword("right one ", parsed.value)).toBe(false);
	});

	it("still verifies v0.1.0 hashes in the $ format", async () => {
		const old = toOldFormat(await hashPassword("from v0.1.0", FAST));
		expect(old).toMatch(/^scrypt\$1024\$8\$1\$/);
		const parsed = parsePasswordHash(old);
		if (!parsed.ok) throw new Error(parsed.error);
		expect(await verifyPassword("from v0.1.0", parsed.value)).toBe(true);
		expect(await verifyPassword("something else", parsed.value)).toBe(false);
	});
});

describe("parsePasswordHash", () => {
	it("rejects malformed hashes", () => {
		for (const bad of [
			"",
			"plain-password",
			"bcrypt$10$8$1$c2FsdHNhbHQ=$aGFzaGhhc2hoYXNoaGFzaA==",
			"scrypt$1000$8$1$c2FsdHNhbHQ=$aGFzaGhhc2hoYXNoaGFzaA==",
			"scrypt$1024$8$1$not base64!$aGFzaGhhc2hoYXNoaGFzaA==",
			"scrypt:1000:8:1:c2FsdHNhbHQ:aGFzaGhhc2hoYXNoaGFzaA",
			"scrypt:1024:8:1:c2FsdHNhbHQ:aGFz aGhhc2hoYXNoaGFzaA",
		]) {
			expect(parsePasswordHash(bad).ok, bad).toBe(false);
		}
	});

	it("refuses a cost that would use too much memory", () => {
		const huge = `scrypt:${2 ** 24}:8:1:c2FsdHNhbHQ:aGFzaGhhc2hoYXNoaGFzaA`;
		expect(parsePasswordHash(huge).ok).toBe(false);
	});

	it("explains the value Compose makes of a v0.1.0 hash", () => {
		// A real-looking v0.1.0 hash (fake values) and what Compose turns it into.
		const old =
			"scrypt$32768$8$1$PxDwq3M9f1Yk2tB7vXcL0w==$Gzll8kq2Zr4Hn1Vb6Yd0Tq3Ws5Ux7Ae9Mc2Pf4Rg6Jh=";
		const mangled = composeInterpolate(old);
		expect(mangled).toBe("scrypt$32768$8$1===");
		const result = parsePasswordHash(mangled);
		expect(result).toEqual({ ok: false, error: MANGLED_HASH_HINT });
		expect(MANGLED_HASH_HINT).toMatch(/Docker Compose/);
		expect(MANGLED_HASH_HINT).toMatch(/hash-password/);
	});

	it("explains a hash that lost only some parts (base64 with / or +)", () => {
		const mangled = composeInterpolate(
			"scrypt$32768$8$1$Ab/cdEfGhIjKlMnOpQrStU==$X+yZaBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789ab=",
		);
		expect(mangled).toBe(
			"scrypt$32768$8$1/cdEfGhIjKlMnOpQrStU==+yZaBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789ab=",
		);
		expect(parsePasswordHash(mangled)).toEqual({
			ok: false,
			error: MANGLED_HASH_HINT,
		});
	});

	it("never repeats the value in an error", () => {
		const secretish = "scrypt:1024:8:1:SECRETSALTVALUE:SECRET!HASH";
		const result = parsePasswordHash(secretish);
		expect(!result.ok && result.error).not.toContain("SECRET");
	});
});

describe("base64url edge cases", () => {
	it("round-trips salts that encode to - and _", async () => {
		for (const byte of [0xfb, 0xff, 0xbf]) {
			const salt = Buffer.alloc(16, byte);
			const hash = await hashPassword("edge case", FAST, salt);
			const encodedSalt = hash.split(":")[4] ?? "";
			expect(encodedSalt).toMatch(/[-_]/);
			const parsed = parsePasswordHash(hash);
			if (!parsed.ok) throw new Error(parsed.error);
			expect(parsed.value.salt.equals(salt)).toBe(true);
			expect(await verifyPassword("edge case", parsed.value)).toBe(true);
		}
	});

	it("rejects padding and standard-base64 characters in the new format", () => {
		const salt = Buffer.alloc(16, 0xfb).toString("base64url");
		const key = Buffer.alloc(32, 1).toString("base64url");
		const good = `scrypt:1024:8:1:${salt}:${key}`;
		expect(parsePasswordHash(good).ok).toBe(true);
		expect(parsePasswordHash(`${good}=`).ok).toBe(false);
		expect(parsePasswordHash(good.replace(/-/g, "+")).ok).toBe(false);
		expect(parsePasswordHash(good.replace(/-/g, "/")).ok).toBe(false);
	});

	it("ignores surrounding whitespace and newlines", async () => {
		const hash = await hashPassword("pw", FAST);
		expect(
			parsePasswordHash(`  ${hash}
`).ok,
		).toBe(true);
	});
});

describe("checkNewPassword", () => {
	it("needs 8 characters and a matching confirmation", () => {
		expect(checkNewPassword("short", "short")).toMatch(/at least 8/);
		expect(checkNewPassword("long enough", "long enougj")).toMatch(/match/);
		expect(checkNewPassword("long enough", "long enough")).toBeNull();
		expect(checkNewPassword("long enough", null)).toBeNull();
	});
});
