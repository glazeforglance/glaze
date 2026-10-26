import { afterEach, describe, expect, it, vi } from "vitest";
import {
	fetchFiles,
	fetchSettings,
	issuesOf,
	putConfig,
	putFile,
	validateConfig,
} from "../src/lib/api.ts";

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
		answer(200, { version: "v2", issues: [] });
		expect(await putConfig("pages: []\n", "v1")).toEqual({
			ok: true,
			value: { version: "v2", issues: [] },
		});
		const call = vi.mocked(fetch).mock.calls[0];
		expect(call?.[0]).toBe("/api/config");
		expect(JSON.parse(String(call?.[1]?.body))).toEqual({
			text: "pages: []\n",
			baseVersion: "v1",
		});
	});

	it("sends force only when asked", async () => {
		answer(200, { version: "v2", issues: [] });
		await putConfig("x", "v1", true);
		const call = vi.mocked(fetch).mock.calls[0];
		expect(JSON.parse(String(call?.[1]?.body))).toEqual({
			text: "x",
			baseVersion: "v1",
			force: true,
		});
	});

	it("reports a conflict with the version on disk", async () => {
		answer(409, { error: "conflict", version: "disk" });
		expect(await putConfig("x", "v1")).toEqual({
			ok: false,
			error: { kind: "conflict", version: "disk" },
		});
	});

	it("reports validation errors with their issues", async () => {
		const issue = {
			severity: "error",
			source: "yaml",
			message: "Bad indent",
			line: 3,
		};
		answer(422, {
			error: "invalid",
			message: "The YAML has errors",
			issues: [issue],
		});
		expect(await putConfig("x", "v1")).toEqual({
			ok: false,
			error: {
				kind: "invalid",
				message: "The YAML has errors",
				issues: [issue],
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

describe("issuesOf", () => {
	it("keeps well-formed issues and drops the rest", () => {
		const fix = {
			kind: "rename-key",
			mapPath: ["pages", 0, "columns", 0, "widgets", 0],
			from: "stlye",
			to: "style",
		};
		expect(
			issuesOf({
				issues: [
					{
						severity: "warning",
						source: "glaze",
						message: "Typo",
						line: 4,
						fix,
					},
					{ severity: "fatal", source: "yaml", message: "?" },
					{ severity: "error", source: "glance", message: 3 },
					"nope",
					{
						severity: "error",
						source: "layout",
						message: "Too many",
						path: ["pages", 0],
						fix: { kind: "other" },
					},
				],
			}),
		).toEqual([
			{ severity: "warning", source: "glaze", message: "Typo", line: 4, fix },
			{
				severity: "error",
				source: "layout",
				message: "Too many",
				path: ["pages", 0],
			},
		]);
		expect(issuesOf(null)).toEqual([]);
	});
});

describe("validateConfig", () => {
	it("posts the draft and returns the issues", async () => {
		const info = { severity: "info", source: "glaze", message: "Off" };
		answer(200, { issues: [info] });
		expect(await validateConfig("pages: []\n")).toEqual({
			ok: true,
			value: [info],
		});
		const call = vi.mocked(fetch).mock.calls[0];
		expect(call?.[0]).toBe("/api/validate");
		expect(call?.[1]?.method).toBe("POST");
	});
});

describe("files and settings", () => {
	it("lists asset files and drops malformed entries", async () => {
		answer(200, {
			files: [
				{ name: "custom.css", language: "css" },
				{ name: "x", language: "go" },
			],
			unavailable: null,
		});
		expect(await fetchFiles()).toEqual({
			ok: true,
			value: {
				files: [{ name: "custom.css", language: "css" }],
				unavailable: null,
			},
		});
	});

	it("encodes each part of a file name but keeps folders", async () => {
		answer(200, { version: "v2" });
		await putFile("js/my design.js", "x", null);
		expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
			"/api/files/js/my%20design.js",
		);
	});

	it("explains a conflict on an asset file", async () => {
		answer(409, { error: "conflict", version: "disk" });
		const result = await putFile("custom.css", "x", "v1");
		expect(result).toMatchObject({
			ok: false,
			error: { kind: "server" },
		});
		expect(JSON.stringify(result)).toContain("changed on disk");
	});

	it("reads the settings", async () => {
		answer(200, { glanceUrl: "http://localhost:8080", glanceValidation: true });
		expect(await fetchSettings()).toEqual({
			ok: true,
			value: { glanceUrl: "http://localhost:8080", glanceValidation: true },
		});
	});
});
