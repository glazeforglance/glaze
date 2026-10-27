import { describe, expect, it } from "vitest";
import {
	glanceReachNotes,
	makeSecretKey,
	maskSecret,
	usernameProblem,
} from "../src/lib/glance-settings.ts";

describe("makeSecretKey", () => {
	it("is 64 random bytes in standard base64, like `glance secret:make`", () => {
		const key = makeSecretKey((bytes) => bytes.fill(255));
		expect(key).toHaveLength(88);
		expect(key).toBe(`${"/".repeat(85)}w==`);
		expect(atob(makeSecretKey())).toHaveLength(64);
		expect(makeSecretKey()).not.toBe(makeSecretKey());
	});
});

describe("maskSecret", () => {
	it("keeps only the start of a hash", () => {
		expect(
			maskSecret(
				"$2a$10$abcdefghijklmnopqrstuuMd7SCiNe0Y6s1MbUCl0bk0KOFk9nGla",
			),
		).toBe("$2a$10$abcd…");
		expect(maskSecret("short")).toBe("•••••");
		expect(maskSecret("")).toBe("");
	});
});

describe("usernameProblem", () => {
	it("follows Glance's rules", () => {
		expect(usernameProblem("al", [])).toMatch(/at least 3/);
		expect(usernameProblem("sean", ["sean"])).toMatch(/already/);
		expect(usernameProblem("a.b.c", [])).toMatch(/dots/);
		expect(usernameProblem(" anna ", ["sean"])).toBeNull();
	});
});

describe("glanceReachNotes", () => {
	it("notices a port that no longer matches a local GLANCE_URL", () => {
		expect(glanceReachNotes("http://localhost:8080", { port: 8080 })).toEqual(
			[],
		);
		expect(glanceReachNotes("http://localhost:8080", {})).toEqual([]);
		expect(
			glanceReachNotes("http://localhost:8080", { port: 9000 })[0],
		).toMatch(/port 9000/);
		// Behind a proxy the ports rightly differ.
		expect(
			glanceReachNotes("https://glance.example.test", { port: 9000 }),
		).toEqual([]);
	});

	it("notices a base URL that GLANCE_URL doesn't include", () => {
		expect(
			glanceReachNotes("http://localhost:8080", { "base-url": "/glance" })[0],
		).toMatch(/base URL of \/glance/);
		expect(
			glanceReachNotes("http://localhost:8080/glance/", {
				"base-url": "/glance/",
			}),
		).toEqual([]);
	});

	it("says when there is no GLANCE_URL at all", () => {
		expect(glanceReachNotes(null, {})[0]).toMatch(/GLANCE_URL isn't set/);
	});
});
