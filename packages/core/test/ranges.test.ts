import { describe, expect, it } from "vitest";
import {
	findPathAtOffset,
	getNodeRange,
	offsetToLineColumn,
	parseConfig,
	validateLayout,
} from "../src/index.ts";
import { load, unwrapErr } from "./helpers/line-diff.ts";

// Fake values only. Comments, an anchor + merge key and ${ENV} references on purpose.
const CONFIG = `# Test config
x-defaults: &monitor-defaults
  cache: 1m

pages:
  - name: Home   # first page
    columns:
      - size: small
        widgets:
          - type: clock
            hour-format: 24h
      - size: full
        widgets:
          # Services
          - type: monitor
            <<: *monitor-defaults
            title: Services
            sites:
              - title: Example
                url: \${EXAMPLE_URL}
          - type: group
            widgets:
              - type: rss
                feeds:
`;

const doc = load(CONFIG);

function lineOf(text: string, needle: string): number {
	const at = text.indexOf(needle);
	if (at === -1) throw new Error(`"${needle}" not in text`);
	return offsetToLineColumn(text, at).line;
}

describe("offsetToLineColumn", () => {
	it("counts lines and columns from 1", () => {
		expect(offsetToLineColumn("ab\ncd", 0)).toEqual({ line: 1, column: 1 });
		expect(offsetToLineColumn("ab\ncd", 4)).toEqual({ line: 2, column: 2 });
	});

	it("clamps offsets outside the text", () => {
		expect(offsetToLineColumn("ab", 99)).toEqual({ line: 1, column: 3 });
		expect(offsetToLineColumn("ab", -5)).toEqual({ line: 1, column: 1 });
	});
});

describe("getNodeRange", () => {
	it("covers a widget from its dash to its last value", () => {
		const range = getNodeRange(doc, ["pages", 0, "columns", 1, "widgets", 0]);
		expect(range).not.toBeNull();
		expect(range?.startLine).toBe(lineOf(CONFIG, "- type: monitor"));
		expect(range?.endLine).toBe(lineOf(CONFIG, "url: ${EXAMPLE_URL}"));
		expect(CONFIG.slice(range?.from, range?.to)).toMatch(
			/^- type: monitor[\s\S]*\$\{EXAMPLE_URL\}$/,
		);
	});

	it("covers a page and a column", () => {
		const page = getNodeRange(doc, ["pages", 0]);
		expect(page?.startLine).toBe(lineOf(CONFIG, "- name: Home"));
		expect(page?.endLine).toBe(lineOf(CONFIG, "feeds:"));
		const column = getNodeRange(doc, ["pages", 0, "columns", 0]);
		expect(column?.startLine).toBe(lineOf(CONFIG, "- size: small"));
		expect(column?.endLine).toBe(lineOf(CONFIG, "hour-format: 24h"));
	});

	it("covers an option from key to value", () => {
		const path = ["pages", 0, "columns", 0, "widgets", 0, "hour-format"];
		const range = getNodeRange(doc, path);
		expect(CONFIG.slice(range?.from, range?.to)).toBe("hour-format: 24h");
		expect(range?.startLine).toBe(range?.endLine);
	});

	it("covers an option with an empty value", () => {
		const path = [
			"pages",
			0,
			"columns",
			1,
			"widgets",
			1,
			"widgets",
			0,
			"feeds",
		];
		const range = getNodeRange(doc, path);
		expect(CONFIG.slice(range?.from, range?.to)).toBe("feeds:");
	});

	it("covers a nested list item and a merge key", () => {
		const widget = ["pages", 0, "columns", 1, "widgets", 0];
		const site = getNodeRange(doc, [...widget, "sites", 0]);
		expect(site?.startLine).toBe(lineOf(CONFIG, "- title: Example"));
		const merge = getNodeRange(doc, [...widget, "<<"]);
		expect(CONFIG.slice(merge?.from, merge?.to)).toBe("<<: *monitor-defaults");
	});

	it("returns null for missing paths", () => {
		expect(getNodeRange(doc, ["pages", 4])).toBeNull();
		expect(getNodeRange(doc, ["pages", 0, "nope"])).toBeNull();
	});

	it("maps layout issues to a line", () => {
		const broken = load(CONFIG.replace("size: small", "size: medium"));
		const [issue] = validateLayout(broken);
		expect(issue?.code).toBe("invalid-column-size");
		const range = issue ? getNodeRange(broken, issue.path) : null;
		expect(range?.startLine).toBe(lineOf(CONFIG, "- size: small"));
	});

	it("works with Windows line endings", () => {
		const crlf = CONFIG.replace(/\n/g, "\r\n");
		const range = getNodeRange(load(crlf), [
			"pages",
			0,
			"columns",
			0,
			"widgets",
			0,
		]);
		expect(range?.startLine).toBe(lineOf(CONFIG, "- type: clock"));
		expect(range?.endLine).toBe(lineOf(CONFIG, "hour-format: 24h"));
		expect(crlf.slice(range?.from, range?.to)).toBe(
			"- type: clock\r\n            hour-format: 24h",
		);
	});
});

describe("findPathAtOffset", () => {
	const at = (needle: string) => findPathAtOffset(doc, CONFIG.indexOf(needle));

	it("finds the widget under the cursor", () => {
		expect(at("hour-format")).toEqual({
			kind: "widget",
			path: ["pages", 0, "columns", 0, "widgets", 0],
		});
		expect(at("${EXAMPLE_URL}")?.path).toEqual([
			"pages",
			0,
			"columns",
			1,
			"widgets",
			0,
		]);
	});

	it("finds the deepest widget inside a group", () => {
		expect(at("feeds:")).toEqual({
			kind: "widget",
			path: ["pages", 0, "columns", 1, "widgets", 1, "widgets", 0],
		});
	});

	it("finds a column or page when no widget is under the cursor", () => {
		expect(at("size: full")).toEqual({
			kind: "column",
			path: ["pages", 0, "columns", 1],
		});
		expect(at("name: Home")).toEqual({ kind: "page", path: ["pages", 0] });
	});

	it("counts the dash of a list item as part of it", () => {
		const offset = CONFIG.indexOf("- type: clock");
		expect(findPathAtOffset(doc, offset)?.kind).toBe("widget");
	});

	it("returns null outside the pages", () => {
		expect(at("x-defaults")).toBeNull();
		expect(at("# Test config")).toBeNull();
	});
});

describe("parse errors", () => {
	it("carry line and column for bad indentation", () => {
		const broken = `pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: clock
         title: oops
`;
		const error = unwrapErr(parseConfig(broken));
		expect(error.code).toBe("yaml-syntax");
		expect(error.line).toBe(7);
		expect(error.column).toBeGreaterThan(0);
	});

	it("carry line and column for a missing anchor", () => {
		const error = unwrapErr(
			parseConfig("pages:\n  - name: Home\n    columns: *nope\n"),
		);
		expect(error).toMatchObject({
			code: "unresolved-alias",
			line: 3,
			column: 14,
		});
	});
});
