import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveAssetPath } from "../src/assets.ts";
import { hashText } from "../src/config-store.ts";
import { checkAssetsAccess } from "../src/startup-check.ts";
import { testApp } from "./helpers/session.ts";

// A typical Docker setup, fake values only: Glance serves /assets from its
// own container; Glaze sees the same host folder somewhere else.
const CONFIG = `server:
  assets-path: /assets
document:
  head: |
    <script src="/assets/js/design.js" defer></script>
    <link rel="stylesheet" href="/assets/../secret.css">
theme:
  custom-css-file: /assets/custom.css
pages:
  - name: Home
    columns:
      - size: full
`;

const CSS = ".widget { border-radius: 4px; }\n";
const SECRET = "/* outside the assets folder */";

let root: string;
let configPath: string;
let assetsDir: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "glaze-assets-path-"));
	await mkdir(join(root, "config"));
	configPath = join(root, "config", "glance.yml");
	await writeFile(configPath, CONFIG, "utf8");
	// Deliberately outside the config folder: GLAZE_ASSETS_PATH may point anywhere.
	assetsDir = join(root, "glance-assets");
	await mkdir(join(assetsDir, "js"), { recursive: true });
	await writeFile(join(assetsDir, "custom.css"), CSS, "utf8");
	await writeFile(join(root, "secret.css"), SECRET, "utf8");
	await writeFile(join(root, "config", "secret.css"), SECRET, "utf8");
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

interface FileList {
	files: { name: string }[];
	unavailable: string | null;
}

describe("without GLAZE_ASSETS_PATH (unchanged behaviour)", () => {
	it("refuses /assets outside the config folder and points to GLAZE_ASSETS_PATH", async () => {
		const glaze = await testApp({ configPath });
		const body = (await (await glaze.request("/api/files")).json()) as FileList;
		expect(body.files).toEqual([]);
		expect(body.unavailable).toContain("outside the config's folder");
		expect(body.unavailable).toContain("GLAZE_ASSETS_PATH");
		expect((await glaze.request("/api/files/custom.css")).status).toBe(404);
	});

	it("still resolves a relative assets-path inside the config folder", () => {
		const text = CONFIG.replace("assets-path: /assets", "assets-path: assets");
		const resolved = resolveAssetPath(configPath, text, "custom.css");
		expect(resolved).toEqual({
			ok: true,
			value: join(root, "config", "assets", "custom.css"),
		});
	});
});

describe("with GLAZE_ASSETS_PATH", () => {
	async function app() {
		return await testApp({ configPath, assetsPath: assetsDir });
	}

	it("maps /assets/… references to files in that folder", async () => {
		const glaze = await app();
		const body = (await (await glaze.request("/api/files")).json()) as FileList;
		expect(body.files.map((file) => file.name)).toEqual([
			"custom.css",
			"js/design.js",
		]);
		expect(body.unavailable).toBeNull();
		const css = await glaze.request("/api/files/custom.css");
		expect(await css.json()).toEqual({
			name: "custom.css",
			text: CSS,
			version: hashText(CSS),
		});
	});

	it("doesn't need server.assets-path to resolve inside Glaze", () => {
		expect(
			resolveAssetPath(configPath, CONFIG, "js/design.js", assetsDir),
		).toEqual({ ok: true, value: join(assetsDir, "js", "design.js") });
	});

	it("writes changes into that folder", async () => {
		const glaze = await app();
		const res = await glaze.request("/api/files/custom.css", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: "/* new */\n", baseVersion: hashText(CSS) }),
		});
		expect(res.status).toBe(200);
		expect(await readFile(join(assetsDir, "custom.css"), "utf8")).toBe(
			"/* new */\n",
		);
	});

	it("refuses path traversal through the API", async () => {
		const glaze = await app();
		for (const path of [
			"/api/files/..%2Fsecret.css",
			"/api/files/..%2F..%2Fsecret.css",
			"/api/files/%2E%2E/secret.css",
			"/api/files/../secret.css",
			"/api/files/..%5Csecret.css",
			"/api/files/js%2F..%2F..%2Fsecret.css",
			"/api/files/%2Fetc%2Fpasswd",
			"/api/files/C:%5CWindows%5Cwin.ini",
		]) {
			const res = await glaze.request(path);
			expect(res.status, path).toBeGreaterThanOrEqual(400);
			expect(await res.text(), path).not.toContain(SECRET);
		}
	});

	it("refuses unsafe names before touching the folder", () => {
		for (const name of [
			"../secret.css",
			"..\\secret.css",
			"js/../../secret.css",
			"%2e%2e/secret.css",
			"/etc/passwd.css",
			"C:\\secret.css",
		]) {
			const result = resolveAssetPath(configPath, CONFIG, name, assetsDir);
			expect(result.ok, name).toBe(false);
			expect(!result.ok && result.error.code, name).toBe("invalid-name");
		}
	});

	it("never lists the traversing <link> from document.head", async () => {
		const glaze = await app();
		const body = (await (await glaze.request("/api/files")).json()) as FileList;
		expect(body.files.map((file) => file.name)).not.toContain("../secret.css");
	});
});

describe("checkAssetsAccess", () => {
	it("accepts an existing, writable folder", async () => {
		expect(await checkAssetsAccess(assetsDir)).toEqual({
			ok: true,
			value: undefined,
		});
	});

	it("explains a missing folder", async () => {
		const missing = join(root, "nope");
		const result = await checkAssetsAccess(missing);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.error).toContain(
			`GLAZE_ASSETS_PATH folder not found: ${missing}`,
		);
	});

	it("refuses a file where a folder should be", async () => {
		const result = await checkAssetsAccess(join(assetsDir, "custom.css"));
		expect(!result.ok && result.error).toMatch(/folder not found/);
	});
});
