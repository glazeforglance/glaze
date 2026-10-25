import { afterEach, describe, expect, it, vi } from "vitest";
import { putConfig } from "../src/lib/api.ts";

function answer(status: number, body: unknown) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify(body), { status })),
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("putConfig", () => {
	it("sends the text and base version, and returns the new version", async () => {
		answer(200, { version: "v2" });
		expect(await putConfig("pages: []\n", "v1")).toEqual({
			ok: true,
			value: { version: "v2" },
		});
		const call = vi.mocked(fetch).mock.calls[0];
		expect(call?.[0]).toBe("/api/config");
		expect(JSON.parse(String(call?.[1]?.body))).toEqual({
			text: "pages: []\n",
			baseVersion: "v1",
		});
	});

	it("reports a conflict with the version on disk", async () => {
		answer(409, { error: "conflict", version: "disk" });
		expect(await putConfig("x", "v1")).toEqual({
			ok: false,
			error: { kind: "conflict", version: "disk" },
		});
	});

	it("reports invalid YAML with its line, and layout issues", async () => {
		answer(422, { error: "invalid-yaml", message: "Bad indent", line: 3 });
		expect(await putConfig("x", "v1")).toMatchObject({
			error: { kind: "invalid", message: "Bad indent", line: 3, issues: [] },
		});
		answer(422, {
			error: "invalid-layout",
			message: "The layout breaks Glance's rules",
			issues: [{ code: "too-many-columns", message: "At most 3", path: [] }],
		});
		expect(await putConfig("x", "v1")).toMatchObject({
			error: {
				kind: "invalid",
				line: null,
				issues: [{ code: "too-many-columns", message: "At most 3" }],
			},
		});
	});

	it("reports server and network errors", async () => {
		answer(500, { error: "io-error", message: "Disk full" });
		expect(await putConfig("x", "v1")).toEqual({
			ok: false,
			error: { kind: "server", message: "Disk full" },
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("Failed to fetch");
			}),
		);
		expect(await putConfig("x", "v1")).toMatchObject({
			error: { kind: "network" },
		});
	});
});
