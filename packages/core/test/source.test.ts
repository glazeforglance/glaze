import { describe, expect, it } from "vitest";
import { getNodeSource } from "../src/index.ts";
import { FULL_FIXTURE, load } from "./helpers/line-diff.ts";

const doc = load(FULL_FIXTURE);
const GROUP = ["pages", 0, "columns", 1, "widgets", 0];

describe("getNodeSource", () => {
	it("returns a widget's text at column 0, with its leading comment", () => {
		const text = getNodeSource(doc, GROUP);
		expect(
			text?.startsWith(
				"# Sonarr upcoming episodes, as tabs.\n- type: group\n  widgets:\n    - &sonarr\n",
			),
		).toBe(true);
		expect(text).toContain('      {{ range .JSON.Array "" }}\n');
		expect(text?.endsWith("      parameters:\n        tags: 2\n")).toBe(true);
	});

	it("keeps trailing comments and merge keys of nested widgets", () => {
		expect(getNodeSource(doc, [...GROUP, "widgets", 1])).toBe(
			"- <<: *sonarr\n  title: Series\n  parameters:\n    tags: 1\n",
		);
		expect(
			getNodeSource(doc, [
				"pages",
				0,
				"columns",
				1,
				"widgets",
				1,
				"widgets",
				1,
			]),
		).toBe("- type: lobsters   # second half of the split\n  limit: 10\n");
	});

	it("works for head-widgets and include items", () => {
		expect(
			getNodeSource(doc, ["pages", 0, "head-widgets", 0])?.split("\n")[0],
		).toBe("- type: search   # search bar above all columns");
		expect(getNodeSource(doc, ["pages", 0, "columns", 1, "widgets", 2])).toBe(
			"- $include: widgets/immich.yml\n",
		);
	});

	it("returns null for paths that are not list items", () => {
		expect(getNodeSource(doc, ["pages", 0, "columns"])).toBeNull();
		expect(getNodeSource(doc, ["pages", 9])).toBeNull();
	});
});
