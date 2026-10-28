import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashText } from "../src/config-store.ts";
import { testApp } from "./helpers/session.ts";

const ORIGINAL = `# Test config, fake values only.
pages:
  - name: Home   # first page
    columns:
      - size: full
        widgets:
          - type: clock
`;

const EDITED = ORIGINAL.replace("name: Home", "name: Start");

const FOUR_COLUMNS = `pages:
  - name: Home
    columns:
      - size: small
      - size: full
      - size: small
      - size: small
`;

let dir: string;
let configPath: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "glaze-api-"));
	configPath = join(dir, "glance.yml");
	await writeFile(configPath, ORIGINAL, "utf8");
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

async function put(body: unknown): Promise<Response> {
	return await (await testApp({ configPath })).request("/api/config", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("GET /api/config", () => {
	it("returns the text and its hash", async () => {
		const res = await (await testApp({ configPath })).request("/api/config");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			text: ORIGINAL,
			version: hashText(ORIGINAL),
		});
	});

	it("returns 404 when the file is missing", async () => {
		const res = await (
			await testApp({ configPath: join(dir, "nope.yml") })
		).request("/api/config");
		expect(res.status).toBe(404);
	});
});

describe("PUT /api/config", () => {
	it("writes the new text and returns the new version", async () => {
		const res = await put({ text: EDITED, baseVersion: hashText(ORIGINAL) });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ version: hashText(EDITED) });
		expect(await readFile(configPath, "utf8")).toBe(EDITED);
	});

	it("leaves no temp files behind", async () => {
		await put({ text: EDITED, baseVersion: hashText(ORIGINAL) });
		expect(await readdir(dir)).toEqual(["glance.yml"]);
	});

	it("returns 409 when the file changed on disk", async () => {
		const byHand = `${ORIGINAL}# edited by hand\n`;
		await writeFile(configPath, byHand, "utf8");
		const res = await put({ text: EDITED, baseVersion: hashText(ORIGINAL) });
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({
			error: "conflict",
			version: hashText(byHand),
		});
		expect(await readFile(configPath, "utf8")).toBe(byHand);
	});

	it("returns 422 for invalid YAML and keeps the file", async () => {
		const res = await put({
			text: "pages:\n  - name: [\n",
			baseVersion: hashText(ORIGINAL),
		});
		expect(res.status).toBe(422);
		const body = (await res.json()) as {
			error: string;
			issues: { source: string; line?: number }[];
		};
		expect(body.error).toBe("invalid");
		expect(body.issues[0]).toMatchObject({ source: "yaml" });
		expect(body.issues[0]?.line).toBeGreaterThan(0);
		expect(await readFile(configPath, "utf8")).toBe(ORIGINAL);
	});

	it("returns 422 with the issues for an invalid layout", async () => {
		const res = await put({
			text: FOUR_COLUMNS,
			baseVersion: hashText(ORIGINAL),
		});
		expect(res.status).toBe(422);
		const body = (await res.json()) as {
			error: string;
			issues: { source: string; severity: string; line?: number }[];
		};
		expect(body.error).toBe("invalid");
		expect(body.issues.filter((issue) => issue.severity === "error")).toEqual([
			expect.objectContaining({ source: "layout", line: 3 }),
		]);
		expect(await readFile(configPath, "utf8")).toBe(ORIGINAL);
	});

	it("returns 400 for a malformed body", async () => {
		expect((await put({ text: EDITED })).status).toBe(400);
		const res = await (await testApp({ configPath })).request("/api/config", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: "not json",
		});
		expect(res.status).toBe(400);
	});
});

describe("PUT /api/config with validation", () => {
	it("writes an invalid layout when forced", async () => {
		const res = await put({
			text: FOUR_COLUMNS,
			baseVersion: hashText(ORIGINAL),
			force: true,
		});
		expect(res.status).toBe(200);
		expect(await readFile(configPath, "utf8")).toBe(FOUR_COLUMNS);
	});

	it("never writes broken YAML, even when forced", async () => {
		const res = await put({
			text: "pages:\n  - name: [\n",
			baseVersion: hashText(ORIGINAL),
			force: true,
		});
		expect(res.status).toBe(422);
		expect(await readFile(configPath, "utf8")).toBe(ORIGINAL);
	});

	it("doesn't block on warnings", async () => {
		const text = EDITED.replace(
			"type: clock",
			"type: clock\n            stlye: x",
		);
		const res = await put({ text, baseVersion: hashText(ORIGINAL) });
		expect(res.status).toBe(200);
		const body = (await res.json()) as { issues: { severity: string }[] };
		expect(body.issues.map((issue) => issue.severity)).toContain("warning");
	});
});

describe("PUT /api/config with server options", () => {
	const withPort = (port: number) =>
		ORIGINAL.replace("pages:", `server:\n  port: ${port}\npages:`);

	async function putIn(
		options: { glazeInContainer?: boolean; glanceUrl?: string },
		body: unknown,
	): Promise<Response> {
		return await (await testApp({ configPath, ...options })).request(
			"/api/config",
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			},
		);
	}

	it("refuses a host that is a URL (the ZimaOS bug)", async () => {
		const text = ORIGINAL.replace(
			"pages:",
			"server:\n  host: http://192.168.178.233\n  port: 8088\npages:",
		);
		const res = await put({ text, baseVersion: hashText(ORIGINAL) });
		expect(res.status).toBe(422);
		const body = (await res.json()) as { issues: { message: string }[] };
		expect(body.issues[0]?.message).toContain("not a URL");
		expect(await readFile(configPath, "utf8")).toBe(ORIGINAL);
	});

	it("needs a confirmation to change the port in a container", async () => {
		const text = withPort(8088);
		const refused = await putIn(
			{ glazeInContainer: true },
			{ text, baseVersion: hashText(ORIGINAL) },
		);
		expect(refused.status).toBe(422);
		expect(await refused.json()).toMatchObject({ error: "unconfirmed" });
		expect(await readFile(configPath, "utf8")).toBe(ORIGINAL);

		const confirmed = await putIn(
			{ glazeInContainer: true },
			{ text, baseVersion: hashText(ORIGINAL), confirmed: true },
		);
		expect(confirmed.status).toBe(200);
		expect(await readFile(configPath, "utf8")).toBe(text);
	});

	it("treats a GLANCE_URL on another port as a container", async () => {
		const res = await putIn(
			{ glanceUrl: "http://192.168.178.233:8088" },
			{ text: withPort(9000), baseVersion: hashText(ORIGINAL) },
		);
		expect(res.status).toBe(422);
	});

	it("doesn't ask outside a container", async () => {
		const res = await putIn(
			{ glanceUrl: "http://localhost:8080" },
			{ text: withPort(9000), baseVersion: hashText(ORIGINAL) },
		);
		expect(res.status).toBe(200);
	});
});

describe("POST /api/validate", () => {
	async function validate(body: unknown): Promise<Response> {
		return await (await testApp({ configPath })).request("/api/validate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	}

	it("checks the draft, not the file on disk", async () => {
		const res = await validate({ text: FOUR_COLUMNS });
		expect(res.status).toBe(200);
		const body = (await res.json()) as { issues: { source: string }[] };
		expect(body.issues.map((issue) => issue.source)).toEqual([
			"layout",
			"glaze",
		]);
	});

	it("returns 400 without text", async () => {
		expect((await validate({})).status).toBe(400);
	});
});

describe("GET /api/settings", () => {
	it("reports the Glance URL and whether validation is on", async () => {
		const off = await (await testApp({ configPath })).request("/api/settings");
		expect(await off.json()).toEqual({
			glanceUrl: null,
			glanceValidation: false,
			glazeInContainer: false,
		});
		const on = await (
			await testApp({
				configPath,
				glanceUrl: "http://localhost:8080",
				glance: { bin: "glance" },
			})
		).request("/api/settings");
		expect(await on.json()).toEqual({
			glanceUrl: "http://localhost:8080",
			glanceValidation: true,
			glazeInContainer: false,
		});
	});
});

describe("POST /api/glance/password-hash", () => {
	const post = async (body: unknown) =>
		(await testApp({ configPath })).request("/api/glance/password-hash", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

	it("returns a bcrypt hash and is never cached", async () => {
		const res = await post({ password: "correct horse" });
		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		const body = (await res.json()) as { hash: string; via: string };
		expect(body.hash).toMatch(/^\$2[ab]\$10\$/);
		expect(body.via).toBe("bcryptjs");
	});

	it("refuses a password Glance refuses, and a bad body", async () => {
		expect((await post({ password: "short" })).status).toBe(400);
		expect((await post({ secret: "nope" })).status).toBe(400);
	});
});
