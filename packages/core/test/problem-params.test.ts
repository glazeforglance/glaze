import { describe, expect, it } from "vitest";
import {
	parseConfig,
	renameKey,
	validateLayout,
	wrapInSplitColumn,
} from "../src/index.ts";
import { load } from "./helpers/line-diff.ts";

// The web app builds its sentences from `code` + `params`, so these must stay stable.
describe("problem params", () => {
	it("gives layout issues the values their sentence needs", () => {
		const doc = load(
			[
				"pages:",
				"  - name: Slim",
				"    width: slim",
				"    columns:",
				"      - size: wide",
				"      - size: small",
				"      - size: small",
				"        widgets:",
				"          - type: group",
				"            widgets:",
				"              - type: split-column",
				"",
			].join("\n"),
		);
		const params = Object.fromEntries(
			validateLayout(doc).map((issue) => [issue.code, issue.params]),
		);
		expect(params["too-many-columns"]).toEqual({ max: 2 });
		expect(params["invalid-column-size"]).toEqual({ size: "wide" });
		expect(params["full-column-count"]).toEqual({ count: 0 });
		expect(params["nested-group"]).toEqual({ type: "split-column" });
	});

	it("names the missing anchor of an alias", () => {
		const parsed = parseConfig("pages:\n  - *missing\n");
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) {
			expect(parsed.error.code).toBe("unresolved-alias");
			expect(parsed.error.params).toEqual({ alias: "missing" });
		}
	});

	it("names the key a rename would duplicate", () => {
		const doc = load(
			"pages:\n  - name: Home\n    slug: home\n    columns:\n      - size: full\n",
		);
		const result = renameKey(doc, ["pages", 0], "slug", "name");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("duplicate-key");
			expect(result.error.params).toEqual({ key: "name" });
		}
	});

	it("refuses a split-column in head widgets with a coded issue", () => {
		const doc = load(
			[
				"pages:",
				"  - name: Home",
				"    head-widgets:",
				"      - type: clock",
				"      - type: calendar",
				"    columns:",
				"      - size: full",
				"",
			].join("\n"),
		);
		const result = wrapInSplitColumn(
			doc,
			["pages", 0, "head-widgets", 0],
			{ kind: "move", path: ["pages", 0, "head-widgets", 1] },
			"right",
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("layout-violation");
			expect(result.error.issues.map((issue) => issue.code)).toEqual([
				"split-in-head",
			]);
		}
	});
});
