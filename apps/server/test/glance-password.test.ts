import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { hashGlancePassword } from "../src/glance-password.ts";

const FAKE = fileURLToPath(
	new URL("./fixtures/fake-glance-hash.mjs", import.meta.url),
);
const fakeGlance = { bin: process.execPath, prefixArgs: [FAKE] };

describe("hashGlancePassword", () => {
	it("hashes with bcryptjs at Glance's cost when there is no Glance binary", async () => {
		const result = await hashGlancePassword("correct horse", null);
		if (!result.ok) throw new Error(result.error.message);
		expect(result.value.via).toBe("bcryptjs");
		expect(result.value.hash).toMatch(/^\$2[ab]\$10\$/);
		expect(await bcrypt.compare("correct horse", result.value.hash)).toBe(true);
	});

	it("uses `glance password:hash` when Glance is there", async () => {
		const result = await hashGlancePassword("correct horse", fakeGlance);
		expect(result).toEqual({
			ok: true,
			value: {
				hash: "$2a$10$abcdefghijklmnopqrstuuMd7SCiNe0Y6s1MbUCl0bk0KOFk9nGla",
				via: "glance",
			},
		});
	});

	it("falls back to bcryptjs when Glance fails", async () => {
		const broken = {
			bin: process.execPath,
			prefixArgs: ["-e", "process.exit(3)"],
		};
		const result = await hashGlancePassword("correct horse", broken);
		expect(result.ok && result.value.via).toBe("bcryptjs");
	});

	it("refuses passwords Glance refuses", async () => {
		expect(await hashGlancePassword("short", null)).toMatchObject({
			ok: false,
			error: { code: "too-short" },
		});
		expect(await hashGlancePassword("x".repeat(73), null)).toMatchObject({
			ok: false,
			error: { code: "too-long" },
		});
	});
});
