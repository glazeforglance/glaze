import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { testAuth, testApp } from "./helpers/session.ts";

const INDEX = `<!doctype html><html><head><meta name="glaze-csp-nonce" content="__GLAZE_CSP_NONCE__" /></head><body>Glaze</body></html>`;

let dir: string;
let web: string;
let configPath: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "glaze-static-"));
	web = join(dir, "web");
	configPath = join(dir, "glance.yml");
	await writeFile(configPath, "pages: []\n", "utf8");
	await mkdir(join(web, "assets"), { recursive: true });
	await writeFile(join(web, "index.html"), INDEX, "utf8");
	await writeFile(
		join(web, "assets", "index-abc123.js"),
		"console.log(1)",
		"utf8",
	);
	await writeFile(join(web, "favicon.svg"), "<svg/>", "utf8");
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

async function app() {
	return createApp({ configPath, auth: await testAuth(), webDist: web });
}

describe("serving the web app", () => {
	it("serves index.html without a session, with the CSP nonce filled in", async () => {
		const res = await (await app()).request("/");
		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe("no-cache");
		const html = await res.text();
		const nonce = /content="([^"]+)"/.exec(html)?.[1] ?? "";
		expect(nonce).not.toBe("__GLAZE_CSP_NONCE__");
		expect(nonce.length).toBeGreaterThan(10);
		expect(res.headers.get("content-security-policy")).toContain(
			`'nonce-${nonce}'`,
		);
	});

	it("uses a new nonce for every response", async () => {
		const glaze = await app();
		const a = await (await glaze.request("/")).text();
		const b = await (await glaze.request("/")).text();
		expect(a).not.toBe(b);
	});

	it("caches hashed assets for a year and other files not at all", async () => {
		const glaze = await app();
		const js = await glaze.request("/assets/index-abc123.js");
		expect(js.status).toBe(200);
		expect(js.headers.get("cache-control")).toBe(
			"public, max-age=31536000, immutable",
		);
		const icon = await glaze.request("/favicon.svg");
		expect(icon.headers.get("cache-control")).toBe("no-cache");
	});

	it("falls back to index.html for app routes", async () => {
		const res = await (await app()).request("/pages/home");
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("Glaze");
	});

	it("answers 404 for a missing asset instead of HTML", async () => {
		const res = await (await app()).request("/assets/old-999.js");
		expect(res.status).toBe(404);
	});

	it("never serves files outside the web folder", async () => {
		const res = await (await app()).request("/..%2fglance.yml");
		expect(await res.text()).not.toContain("pages: []");
	});

	it("keeps unknown /api routes JSON: 401 without, 404 with a session", async () => {
		expect((await (await app()).request("/api/nope")).status).toBe(401);
		const loggedIn = await testApp({ configPath, webDist: web });
		const res = await loggedIn.request("/api/nope");
		expect(res.status).toBe(404);
		expect(await res.json()).toMatchObject({ error: "not-found" });
	});
});
