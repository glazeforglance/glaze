import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { hashText } from "../src/config-store.ts";

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
	return await createApp({ configPath }).request("/api/config", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("GET /api/config", () => {
	it("returns the text and its hash", async () => {
		const res = await createApp({ configPath }).request("/api/config");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			text: ORIGINAL,
			version: hashText(ORIGINAL),
		});
	});

	it("returns 404 when the file is missing", async () => {
		const res = await createApp({ configPath: join(dir, "nope.yml") }).request(
			"/api/config",
		);
		expect(res.status).toBe(404);
	});
});

describe("PUT /api/config", () => {
	it("writes the new text and returns the new version", async () => {
		const res = await put({ text: EDITED, baseVersion: hashText(ORIGINAL) });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ version: hashText(EDITED) });
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
		expect(await res.json()).toMatchObject({ error: "invalid-yaml" });
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
			issues: { code: string }[];
		};
		expect(body.error).toBe("invalid-layout");
		expect(body.issues.map((issue) => issue.code)).toEqual([
			"too-many-columns",
		]);
		expect(await readFile(configPath, "utf8")).toBe(ORIGINAL);
	});

	it("returns 400 for a malformed body", async () => {
		expect((await put({ text: EDITED })).status).toBe(400);
		const res = await createApp({ configPath }).request("/api/config", {
			method: "PUT",
			body: "not json",
		});
		expect(res.status).toBe(400);
	});
});
