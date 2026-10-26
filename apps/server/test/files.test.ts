import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { findReferencedAssets, isSafeName } from "../src/assets.ts";
import { hashText } from "../src/config-store.ts";

// Fake values only.
const CONFIG = `server:
  assets-path: assets
document:
  head: |
    <script src="/assets/js/design.js" defer></script>
    <link rel="stylesheet" href="/assets/../secret.css">
    <script src="https://cdn.example.com/x.js"></script>
theme:
  custom-css-file: /assets/custom.css?v=2
pages:
  - name: Home
    columns:
      - size: full
`;

const CSS = ".widget { border-radius: 4px; }\n";

let dir: string;
let configPath: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "glaze-files-"));
	configPath = join(dir, "glance.yml");
	await writeFile(configPath, CONFIG, "utf8");
	await mkdir(join(dir, "assets"));
	await writeFile(join(dir, "assets", "custom.css"), CSS, "utf8");
	await writeFile(
		join(dir, "assets", "other.css"),
		"/* not referenced */",
		"utf8",
	);
	await writeFile(join(dir, "secret.css"), "/* outside assets */", "utf8");
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

function request(path: string, init?: RequestInit): Promise<Response> {
	return Promise.resolve(createApp({ configPath }).request(path, init));
}

function put(name: string, body: unknown): Promise<Response> {
	return request(`/api/files/${name}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("findReferencedAssets / isSafeName", () => {
	it("finds the custom CSS file and /assets/ links in document.head", () => {
		expect(findReferencedAssets(CONFIG)).toEqual([
			{ name: "custom.css", language: "css" },
			{ name: "js/design.js", language: "javascript" },
		]);
	});

	it("rejects unsafe names", () => {
		for (const name of [
			"../glance.yml",
			"a/../b.css",
			"/etc/x.css",
			"C:\\x.css",
			"a\\b.css",
			"a%2Fb.css",
			"./a.css",
			"glance.yml",
			"",
		]) {
			expect(isSafeName(name), name).toBe(false);
		}
		expect(isSafeName("css/theme.min.css")).toBe(true);
	});
});

describe("GET /api/files", () => {
	it("lists the referenced files", async () => {
		const res = await request("/api/files");
		expect(await res.json()).toEqual({
			files: [
				{ name: "custom.css", language: "css" },
				{ name: "js/design.js", language: "javascript" },
			],
			unavailable: null,
		});
	});

	it("lists nothing when the assets path is outside the config folder", async () => {
		await writeFile(
			configPath,
			CONFIG.replace("assets-path: assets", "assets-path: ../elsewhere"),
		);
		const body = (await (await request("/api/files")).json()) as {
			files: unknown[];
			unavailable: string | null;
		};
		expect(body.files).toEqual([]);
		expect(body.unavailable).toContain("outside");
		expect((await request("/api/files/custom.css")).status).toBe(404);
	});
});

describe("GET /api/files/:name", () => {
	it("returns a file with its version", async () => {
		const res = await request("/api/files/custom.css");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			name: "custom.css",
			text: CSS,
			version: hashText(CSS),
		});
	});

	it("returns an empty text and no version for a missing file", async () => {
		const res = await request("/api/files/js/design.js");
		expect(await res.json()).toEqual({
			name: "js/design.js",
			text: "",
			version: null,
		});
	});

	it("refuses files that aren't referenced", async () => {
		expect((await request("/api/files/other.css")).status).toBe(404);
	});

	it("refuses path traversal", async () => {
		for (const path of [
			"/api/files/..%2Fglance.yml",
			"/api/files/..%2F..%2Fetc%2Fpasswd",
			"/api/files/%2E%2E/glance.yml",
			"/api/files/../glance.yml",
			"/api/files/..%5Cglance.yml",
			"/api/files/%2Fetc%2Fpasswd",
			"/api/files/C:%5CWindows%5Cwin.ini",
			"/api/files/..%2Fsecret.css",
			"/api/files/assets%2F..%2F..%2Fsecret.css",
		]) {
			const res = await request(path);
			expect(res.status, path).toBeGreaterThanOrEqual(400);
			expect(await res.text(), path).not.toContain("outside assets");
		}
	});

	it("refuses files that aren't UTF-8 text", async () => {
		await writeFile(
			join(dir, "assets", "custom.css"),
			Buffer.from([0xff, 0xfe, 0x00, 0xd8]),
		);
		expect((await request("/api/files/custom.css")).status).toBe(422);
	});
});

describe("PUT /api/files/:name", () => {
	it("writes a file based on its version", async () => {
		const next = `${CSS}.widget { gap: 0; }\n`;
		const res = await put("custom.css", {
			text: next,
			baseVersion: hashText(CSS),
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ version: hashText(next) });
		expect(await readFile(join(dir, "assets", "custom.css"), "utf8")).toBe(
			next,
		);
	});

	it("creates a missing file with baseVersion null", async () => {
		await mkdir(join(dir, "assets", "js"));
		const res = await put("js/design.js", {
			text: "console.log(1);\n",
			baseVersion: null,
		});
		expect(res.status).toBe(200);
		expect(await readFile(join(dir, "assets", "js", "design.js"), "utf8")).toBe(
			"console.log(1);\n",
		);
	});

	it("returns 409 when the file changed on disk", async () => {
		const res = await put("custom.css", { text: "x", baseVersion: "old" });
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ version: hashText(CSS) });
		expect(await readFile(join(dir, "assets", "custom.css"), "utf8")).toBe(CSS);
	});

	it("refuses traversal, unreferenced files and huge files", async () => {
		expect(
			(await put("..%2Fsecret.css", { text: "x", baseVersion: null })).status,
		).toBe(400);
		expect(
			(await put("other.css", { text: "x", baseVersion: null })).status,
		).toBe(404);
		const huge = "a".repeat(1024 * 1024 + 1);
		expect(
			(await put("custom.css", { text: huge, baseVersion: hashText(CSS) }))
				.status,
		).toBe(422);
		expect(await readFile(join(dir, "secret.css"), "utf8")).toBe(
			"/* outside assets */",
		);
	});

	it("returns 400 for a malformed body", async () => {
		expect((await put("custom.css", { text: 1 })).status).toBe(400);
	});
});
