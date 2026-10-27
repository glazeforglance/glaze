import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	addWidget,
	type GlazeDocument,
	parseConfig,
	serializeConfig,
	type WidgetInput,
} from "@glaze/core";
import { WIDGET_SCHEMAS, WIDGET_TYPES } from "@glaze/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runGlanceValidate } from "../src/glance-validate.ts";
import { validateDraft } from "../src/validate.ts";

/*
 * Everything Glaze writes must be valid for Glance: every widget fixture
 * (packages/schemas/test/fixtures) and every widget as the library adds it.
 * Glaze's own checks always run; `glance config:validate` runs when
 * GLANCE_BIN points to a Glance v0.8.7 binary (CI downloads one).
 */

const FIXTURES = fileURLToPath(
	new URL("../../../packages/schemas/test/fixtures/", import.meta.url),
);
const GLANCE_BIN = process.env.GLANCE_BIN;

/** The fixture text as a list item in a column (comments included). */
function asItem(text: string): string {
	const lines = text
		.replace(/\r\n/g, "\n")
		.split("\n")
		.filter((line) => line !== "");
	const firstKey = lines.findIndex((line) => !line.startsWith("#"));
	return lines
		.map((line, index) => {
			if (index === firstKey) return `          - ${line}`;
			return line.startsWith("#") ? `          ${line}` : `            ${line}`;
		})
		.join("\n");
}

function unwrap(
	result:
		| { ok: true; value: GlazeDocument }
		| { ok: false; error: { message: string } },
) {
	if (!result.ok) throw new Error(result.error.message);
	return result.value;
}

let fixturesConfig = "";
let newWidgetsConfig = "";
let dir = "";

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), "glaze-glance-"));
	const names = (await readdir(FIXTURES))
		.filter((name) => name.endsWith(".yml"))
		.sort();
	const items = await Promise.all(
		names.map(async (name) =>
			asItem(await readFile(join(FIXTURES, name), "utf8")),
		),
	);
	fixturesConfig = `pages:\n  - name: Fixtures\n    columns:\n      - size: full\n        widgets:\n${items.join("\n")}\n`;

	// Every widget type as the library adds it: its type plus its schema's starting options.
	let doc = unwrap(
		parseConfig(
			"pages:\n  - name: New widgets\n    columns:\n      - size: full\n",
		),
	);
	for (const type of WIDGET_TYPES) {
		const widget: WidgetInput = {
			type,
			...(WIDGET_SCHEMAS[type]?.newWidget ?? {}),
		};
		doc = unwrap(addWidget(doc, ["pages", 0, "columns", 0, "widgets"], widget));
	}
	newWidgetsConfig = serializeConfig(doc);
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

async function glazeIssues(text: string) {
	const issues = await validateDraft(text, {
		configPath: join(dir, "glance.yml"),
		glance: null,
	});
	return issues.filter((issue) => issue.severity !== "info");
}

describe("Glaze's own checks", () => {
	it("find nothing wrong in the fixtures", async () => {
		expect(await glazeIssues(fixturesConfig)).toEqual([]);
	});

	it("find nothing wrong in new widgets, except a required option without an example", async () => {
		const issues = await glazeIssues(newWidgetsConfig);
		// The extension widget can't start valid: its URL is your own service.
		expect(issues.map((issue) => issue.message)).toEqual([
			"Extension needs a URL",
		]);
	});
});

describe.skipIf(!GLANCE_BIN)("glance config:validate (Glance v0.8.7)", () => {
	const command = { bin: GLANCE_BIN ?? "", timeoutMs: 30_000 };

	it("accepts every fixture", async () => {
		const issues = await runGlanceValidate(
			fixturesConfig,
			join(dir, "glance.yml"),
			command,
		);
		expect(issues).toEqual([]);
	});

	it("accepts every widget as the library adds it (with the extension's URL filled in)", async () => {
		const text = newWidgetsConfig.replace(
			"- type: extension\n",
			"- type: extension\n            url: https://extension.example.test/widget\n",
		);
		expect(text).not.toBe(newWidgetsConfig);
		const issues = await runGlanceValidate(
			text,
			join(dir, "glance.yml"),
			command,
		);
		expect(issues).toEqual([]);
	});

	it("still refuses what it should (the test can fail)", async () => {
		const broken = fixturesConfig.replace("units: metric", "units: kelvin");
		const issues = await runGlanceValidate(
			broken,
			join(dir, "glance.yml"),
			command,
		);
		expect(issues.some((issue) => issue.severity === "error")).toBe(true);
	});
});
