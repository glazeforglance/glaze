import { describe, expect, it } from "vitest";
import { checkNewPassword } from "../src/hash-password.ts";
import {
	hashPassword,
	parsePasswordHash,
	verifyPassword,
} from "../src/password.ts";

const FAST = { N: 1024, r: 8, p: 1 };

describe("hashPassword", () => {
	it("uses the format scrypt$N$r$p$salt$hash", async () => {
		const hash = await hashPassword("hunter2-but-longer", FAST);
		expect(hash).toMatch(
			/^scrypt\$1024\$8\$1\$[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*$/,
		);
		const parsed = parsePasswordHash(hash);
		expect(parsed.ok && parsed.value.salt.length).toBe(16);
		expect(parsed.ok && parsed.value.hash.length).toBe(32);
	});

	it("uses the default cost when none is given", async () => {
		expect(await hashPassword("x")).toMatch(/^scrypt\$32768\$8\$1\$/);
	});

	it("salts every hash differently", async () => {
		const a = await hashPassword("same password", FAST);
		const b = await hashPassword("same password", FAST);
		expect(a).not.toBe(b);
	});
});

describe("verifyPassword", () => {
	it("accepts the right password", async () => {
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
});

describe("parsePasswordHash", () => {
	it("rejects malformed hashes", () => {
		for (const bad of [
			"",
			"plain-password",
			"bcrypt$10$8$1$c2FsdHNhbHQ=$aGFzaGhhc2hoYXNoaGFzaA==",
			"scrypt$1000$8$1$c2FsdHNhbHQ=$aGFzaGhhc2hoYXNoaGFzaA==",
			"scrypt$1024$8$1$not base64!$aGFzaGhhc2hoYXNoaGFzaA==",
			"scrypt$1024$8$1$c2FsdHNhbHQ=",
		]) {
			expect(parsePasswordHash(bad).ok, bad).toBe(false);
		}
	});

	it("refuses a cost that would use too much memory", () => {
		const huge = `scrypt$${2 ** 24}$8$1$c2FsdHNhbHQ=$aGFzaGhhc2hoYXNoaGFzaA==`;
		expect(parsePasswordHash(huge).ok).toBe(false);
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
