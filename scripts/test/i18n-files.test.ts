import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { checkTranslations, refreshStatusTable } from "../i18n-files.ts";
import { parseStatus } from "../i18n-lib.ts";

const TRANSLATING = `# Translating

<!-- i18n-status:start -->

| Language | Code | Translated |
| -------- | ---- | ---------- |
| English  | \`en\` | 100%       |

<!-- i18n-status:end -->

Updated with every release.
`;

let root = "";

function put(path: string, text: string): void {
	const file = join(root, path);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, text);
}

/** A tiny repository: English with two texts, code that uses both, TRANSLATING.md. */
beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "glaze-i18n-"));
	put(
		"apps/web/src/locales/en/app.json",
		JSON.stringify({ common: { cancel: "Cancel", hello: "Hi {{name}}" } }),
	);
	put("apps/web/src/locales/en/fields.json", "{}");
	put(
		"apps/web/src/app.ts",
		't("common.cancel"); t("common.hello", { name });',
	);
	put("TRANSLATING.md", TRANSLATING);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("refreshStatusTable (release:prepare)", () => {
	it("adds a new locale folder to the table and lists the change", () => {
		put(
			"apps/web/src/locales/fil/app.json",
			JSON.stringify({ common: { cancel: "Kanselahin" } }),
		);
		const refresh = refreshStatusTable(root);
		assert.ok(refresh.ok);
		assert.notEqual(refresh.after, refresh.before);
		assert.equal(parseStatus(refresh.after).get("fil"), 50);
		assert.deepEqual(refresh.changes, ["fil 0% → 50%"]);
		// Everything outside the markers stays as it was.
		assert.ok(refresh.after.endsWith("\n\nUpdated with every release.\n"));
	});

	it("leaves TRANSLATING.md byte for byte unchanged when nothing changed", () => {
		const first = refreshStatusTable(root);
		assert.ok(first.ok);
		put("TRANSLATING.md", first.after);
		const second = refreshStatusTable(root);
		assert.ok(second.ok);
		assert.equal(second.after, second.before);
		assert.equal(second.after, first.after);
		assert.deepEqual(second.changes, []);
	});

	it("doesn't stop for an incomplete or empty language", () => {
		put("apps/web/src/locales/de/app.json", "{}");
		const refresh = refreshStatusTable(root);
		assert.ok(refresh.ok);
		assert.equal(parseStatus(refresh.after).get("de"), 0);
	});

	it("stops for invalid JSON or a broken placeholder", () => {
		put("apps/web/src/locales/nl/app.json", "{ broken");
		assert.equal(refreshStatusTable(root).ok, false);
		put(
			"apps/web/src/locales/nl/app.json",
			JSON.stringify({ common: { hello: "Hoi {{naam}}" } }),
		);
		const refresh = refreshStatusTable(root);
		assert.equal(refresh.ok, false);
		assert.match(refresh.ok ? "" : refresh.errors.join(), /placeholders/);
	});
});

describe("checkTranslations (pnpm i18n --check)", () => {
	it("notes a stale table but doesn't fail on it", () => {
		put(
			"apps/web/src/locales/fil/app.json",
			JSON.stringify({ common: { cancel: "Kanselahin" } }),
		);
		const check = checkTranslations(root);
		assert.equal(check.staleTable, true);
		assert.deepEqual(check.errors, []);
	});

	it("knows when the table is up to date", () => {
		const refresh = refreshStatusTable(root);
		assert.ok(refresh.ok);
		put("TRANSLATING.md", refresh.after);
		assert.equal(checkTranslations(root).staleTable, false);
	});

	it("still fails when the code and English disagree", () => {
		put("apps/web/src/app.ts", 't("common.cancel"); t("common.gone");');
		const errors = checkTranslations(root).errors.join("\n");
		assert.match(errors, /doesn't use: common\.hello/);
		assert.match(errors, /doesn't have: common\.gone/);
	});
});
