import { describe, expect, it } from "vitest";
import {
	closestKey,
	COLUMN_KEYS,
	editDistance,
	findUnknownOptions,
	getNodeRange,
	type KnownKeys,
	PAGE_KEYS,
	renameKey,
	serializeConfig,
	WIDGET_BASE_KEYS,
	WIDGET_TYPE_KEYS,
} from "../src/index.ts";
import {
	expectLineChanges,
	load,
	unwrap,
	unwrapErr,
} from "./helpers/line-diff.ts";

const KNOWN: KnownKeys = {
	page: PAGE_KEYS,
	column: COLUMN_KEYS,
	widgetBase: WIDGET_BASE_KEYS,
	widgetTypes: WIDGET_TYPE_KEYS,
};

// Fake values only.
const CONFIG = `defaults: &defaults
  cache: 5m
  colour: red   # unknown, but only inside the anchor

pages:
  - name: Home
    sulg: home   # typo
    columns:
      - size: full
        widgets:
          - type: monitor
            <<: *defaults
            title: Services   # keep this comment
            stlye: compact
            sites:
              - url: \${MONITOR_URL}
          - type: custom-api
            whatever: 1
          - $include: widgets/extra.yml
          - type: clock
            style: compact
            hour-formatt: 24h
            totally-different: true
`;

describe("editDistance / closestKey", () => {
	it("counts single-character edits", () => {
		expect(editDistance("stlye", "style")).toBe(2);
		expect(editDistance("cache", "cache")).toBe(0);
		expect(editDistance("", "abc")).toBe(3);
	});

	it("suggests only close keys", () => {
		expect(closestKey("stlye", ["title", "style", "sites"])).toBe("style");
		expect(closestKey("totally-different", ["style"])).toBeNull();
	});
});

describe("findUnknownOptions", () => {
	const doc = load(CONFIG);
	const found = findUnknownOptions(doc, KNOWN);

	it("finds typos in pages and widgets, with suggestions", () => {
		expect(found).toEqual([
			{ path: ["pages", 0, "sulg"], key: "sulg", suggestion: "slug" },
			{
				path: ["pages", 0, "columns", 0, "widgets", 0, "stlye"],
				key: "stlye",
				suggestion: "style",
			},
			{
				path: ["pages", 0, "columns", 0, "widgets", 3, "style"],
				key: "style",
				suggestion: null,
			},
			{
				path: ["pages", 0, "columns", 0, "widgets", 3, "hour-formatt"],
				key: "hour-formatt",
				suggestion: "hour-format",
			},
			{
				path: ["pages", 0, "columns", 0, "widgets", 3, "totally-different"],
				key: "totally-different",
				suggestion: null,
			},
		]);
	});

	it("gives paths that map to the right line", () => {
		const stlye = found[1];
		const range = stlye ? getNodeRange(doc, stlye.path) : null;
		expect(range?.startLine).toBe(14);
	});

	it("skips merge keys, anchors, unknown types and includes", () => {
		const keys = found.map((option) => option.key);
		expect(keys).not.toContain("<<");
		expect(keys).not.toContain("colour");
		expect(keys).not.toContain("whatever");
		expect(keys).not.toContain("$include");
	});

	it("doesn't suggest a key that is already set", () => {
		const doc2 = load(
			"pages:\n  - name: A\n    columns:\n      - size: full\n        widgets:\n          - type: monitor\n            style: x\n            stlye: y\n",
		);
		expect(findUnknownOptions(doc2, KNOWN)[0]?.suggestion).toBeNull();
	});

	it("skips pages and columns when no keys are given for them", () => {
		const onlyWidgets = findUnknownOptions(doc, {
			widgetBase: WIDGET_BASE_KEYS,
			widgetTypes: WIDGET_TYPE_KEYS,
		});
		expect(onlyWidgets.map((option) => option.key)).not.toContain("sulg");
	});
});

describe("renameKey", () => {
	const doc = load(CONFIG);
	const widget = ["pages", 0, "columns", 0, "widgets", 0];

	it("changes only the key, keeping comments and everything else", () => {
		const next = serializeConfig(
			unwrap(renameKey(doc, widget, "stlye", "style")),
		);
		expectLineChanges(CONFIG, next, {
			removed: ["            stlye: compact"],
			added: ["            style: compact"],
		});
	});

	it("keeps a trailing comment on the renamed line", () => {
		const next = serializeConfig(
			unwrap(renameKey(doc, ["pages", 0], "sulg", "slug")),
		);
		expect(next).toContain("    slug: home   # typo\n");
	});

	it("refuses a key that already exists", () => {
		const error = unwrapErr(renameKey(doc, widget, "stlye", "title"));
		expect(error.code).toBe("duplicate-key");
	});

	it("refuses a missing key or map", () => {
		expect(unwrapErr(renameKey(doc, widget, "nope", "style")).code).toBe(
			"option-not-found",
		);
		expect(unwrapErr(renameKey(doc, ["pages", 9], "a", "b")).code).toBe(
			"not-found",
		);
	});

	it("refuses keys that would need quoting", () => {
		expect(unwrapErr(renameKey(doc, widget, "stlye", "a: b")).code).toBe(
			"invalid-path",
		);
	});
});
