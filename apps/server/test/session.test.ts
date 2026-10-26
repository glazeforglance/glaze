import { describe, expect, it } from "vitest";
import {
	createSessionToken,
	passwordTag,
	readSessionToken,
} from "../src/session.ts";

const SECRET = "test-secret-0123456789abcdefghijklmnop";
const NOW = 1_800_000_000_000;
const payload = { user: "admin", exp: NOW + 60_000, pwdTag: "abc" };

describe("session tokens", () => {
	it("round-trips a valid payload", () => {
		const token = createSessionToken(payload, SECRET);
		expect(readSessionToken(token, SECRET, NOW)).toEqual({
			ok: true,
			value: payload,
		});
	});

	it("rejects a tampered payload", () => {
		const token = createSessionToken(payload, SECRET);
		const [, signature] = token.split(".");
		const forged = Buffer.from(
			JSON.stringify({ ...payload, user: "root" }),
		).toString("base64url");
		expect(readSessionToken(`${forged}.${signature}`, SECRET, NOW)).toEqual({
			ok: false,
			error: "bad-signature",
		});
	});

	it("rejects a tampered signature", () => {
		const token = createSessionToken(payload, SECRET);
		const flipped = `${token.slice(0, -2)}${token.endsWith("A") ? "BB" : "AA"}`;
		expect(readSessionToken(flipped, SECRET, NOW).ok).toBe(false);
	});

	it("rejects a token signed with another secret", () => {
		const token = createSessionToken(payload, `${SECRET}-other`);
		expect(readSessionToken(token, SECRET, NOW).ok).toBe(false);
	});

	it("rejects an expired token", () => {
		const token = createSessionToken(payload, SECRET);
		expect(readSessionToken(token, SECRET, payload.exp)).toEqual({
			ok: false,
			error: "expired",
		});
	});

	it("rejects garbage", () => {
		for (const bad of ["", "abc", "a.b.c", "....", "x.y"]) {
			expect(readSessionToken(bad, SECRET, NOW).ok, bad).toBe(false);
		}
	});
});

describe("passwordTag", () => {
	it("changes with the password and the secret, and is short", () => {
		const tag = passwordTag(SECRET, "scrypt$a");
		expect(tag).toMatch(/^[0-9a-f]{16}$/);
		expect(passwordTag(SECRET, "scrypt$a")).toBe(tag);
		expect(passwordTag(SECRET, "scrypt$b")).not.toBe(tag);
		expect(passwordTag(`${SECRET}x`, "scrypt$a")).not.toBe(tag);
	});
});
