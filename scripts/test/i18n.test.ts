import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	compareLanguage,
	flatten,
	isUsed,
	parseTranslations,
	placeholders,
	replaceStatus,
	requiredKeys,
	statusTable,
	usedKeys,
} from "../i18n-lib.ts";

const EN = flatten({
	common: { cancel: "Cancel" },
	files_one: "{{count}} file",
	files_other: "{{count}} files",
	deleteTitle: "Delete “<name>{{name}}</name>”?",
	head: "Extra <head> HTML",
});

describe("placeholders", () => {
	it("finds variables and Trans tags", () => {
		assert.deepEqual(placeholders("Delete <name>{{name}}</name>?"), [
			"</name>",
			"<name>",
			"{{name}}",
		]);
		assert.deepEqual(placeholders("{{count, number}} items"), ["{{count}}"]);
	});

	it("ignores a lone tag that is just text", () => {
		assert.deepEqual(placeholders("Extra <head> HTML"), []);
	});
});

describe("parseTranslations", () => {
	it("refuses invalid JSON and wrong shapes", () => {
		assert.equal(parseTranslations("{ nope").ok, false);
		assert.equal(parseTranslations('{"a": 1}').ok, false);
		assert.equal(parseTranslations('{"a": {"b": "c"}}').ok, true);
	});
});

describe("compareLanguage", () => {
	it("reports missing keys, as a warning count", () => {
		const report = compareLanguage(
			EN,
			flatten({ common: { cancel: "Annuleren" } }),
			"nl",
		);
		assert.deepEqual(report.missing.sort(), [
			"deleteTitle",
			"files_one",
			"files_other",
			"head",
		]);
		assert.equal(report.translated, 1);
		assert.equal(report.total, 5);
		assert.deepEqual(report.placeholderErrors, []);
	});

	it("counts empty texts as missing", () => {
		const report = compareLanguage(
			EN,
			flatten({ common: { cancel: "" } }),
			"nl",
		);
		assert.ok(report.missing.includes("common.cancel"));
	});

	it("reports keys English doesn't have", () => {
		const report = compareLanguage(EN, flatten({ old: "Oud" }), "nl");
		assert.deepEqual(report.unused, ["old"]);
	});

	it("fails on a changed or dropped placeholder or tag", () => {
		const report = compareLanguage(
			EN,
			flatten({
				deleteTitle: "“{{naam}}” verwijderen?",
				files_one: "{{count}} bestand",
				files_other: "{{count}} bestanden",
			}),
			"nl",
		);
		assert.deepEqual(report.placeholderErrors, ["deleteTitle"]);
	});

	it("allows a singular form without {{count}}", () => {
		const report = compareLanguage(
			EN,
			flatten({ files_one: "Eén bestand" }),
			"nl",
		);
		assert.deepEqual(report.placeholderErrors, []);
	});

	it("asks for the language's own plural forms", () => {
		assert.deepEqual(requiredKeys(["files_one", "files_other"], "ja"), [
			"files_other",
		]);
		assert.equal(requiredKeys(["files_one", "files_other"], "ar").length, 6);
		const report = compareLanguage(
			EN,
			flatten({
				files_few: "{{count}} soubory",
				files_one: "{{count}} soubor",
			}),
			"cs",
		);
		assert.ok(report.missing.includes("files_many"));
		assert.ok(!report.unused.includes("files_few"));
	});
});

describe("usedKeys", () => {
	const used = usedKeys([
		'const a = t("common.cancel"); <Trans i18nKey="deleteTitle" />',
		'i18n.t(`problems.${code}`, params); t("review.files", { count })',
	]);

	it("finds literal keys, plural bases and template prefixes", () => {
		assert.ok(isUsed("common.cancel", used));
		assert.ok(isUsed("review.files_one", used));
		assert.ok(isUsed("problems.no-pages", used));
		assert.ok(!isUsed("common.dismiss", used));
	});

	it("knows which keys are passed to t()", () => {
		assert.ok(used.called.has("common.cancel"));
		assert.ok(used.called.has("deleteTitle"));
	});
});

describe("status table", () => {
	it("writes percentages between the markers", () => {
		const table = statusTable([
			{ name: "English", code: "en", translated: 1, total: 1 },
			{ name: "Dutch (Nederlands)", code: "nl", translated: 1, total: 3 },
		]);
		assert.match(table, /\| Dutch \(Nederlands\) \| `nl` \| 33% \|/);
		const doc =
			"a\n<!-- i18n-status:start -->\nold\n<!-- i18n-status:end -->\nb";
		assert.equal(
			replaceStatus(doc, "T"),
			"a\n<!-- i18n-status:start -->\n\nT\n\n<!-- i18n-status:end -->\nb",
		);
		assert.equal(replaceStatus("no markers", "T"), null);
	});
});
