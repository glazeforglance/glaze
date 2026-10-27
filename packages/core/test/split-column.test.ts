import { describe, expect, it } from "vitest";
import {
	addToSplitColumn,
	columnSizeProblem,
	getModel,
	glazeLayoutIssues,
	moveWidget,
	serializeConfig,
	setSplitColumns,
	unwrapSplitColumn,
	wrapInSplitColumn,
} from "../src/index.ts";
import {
	commentsOf,
	expectLineChanges,
	FULL_FIXTURE,
	load,
	unwrap,
	unwrapErr,
} from "./helpers/line-diff.ts";

const source = FULL_FIXTURE;
const doc = load(source);

const HOME = ["pages", 0] as const;
const CLOCK = [...HOME, "columns", 0, "widgets", 0];
const WEER = [...HOME, "columns", 0, "widgets", 1];
const GROUP = [...HOME, "columns", 1, "widgets", 0];
const SPLIT = [...HOME, "columns", 1, "widgets", 1];
const BOOKMARKS = [...HOME, "columns", 2, "widgets", 0];
const HEAD_SEARCH = [...HOME, "head-widgets", 0];

const typesOf = (widgets: readonly { type: string | null }[] | undefined) =>
	widgets?.map((widget) => widget.type);

describe("wrapInSplitColumn", () => {
	it("puts a new widget beside a widget, in place of that widget", () => {
		const next = unwrap(
			wrapInSplitColumn(
				doc,
				CLOCK,
				{ kind: "new", widget: { type: "calendar" } },
				"left",
			),
		);
		expectLineChanges(source, serializeConfig(next), {
			removed: [
				"          - type: clock",
				"            hour-format: 24h",
				"            timezones:",
				"              - timezone: Europe/Amsterdam",
				"                label: Thuis",
			],
			added: [
				"          - type: split-column",
				"            max-columns: 2",
				"            widgets:",
				"              - type: calendar",
				"",
				"              - type: clock",
				"                hour-format: 24h",
				"                timezones:",
				"                  - timezone: Europe/Amsterdam",
				"                    label: Thuis",
			],
		});
		const split = getModel(next)[0]?.columns[0]?.widgets[0];
		expect(split?.type).toBe("split-column");
		expect(split?.maxColumns).toBe(2);
		expect(typesOf(split?.children)).toEqual(["calendar", "clock"]);
	});

	it("moves a widget beside another one; ids follow both widgets", () => {
		const before = getModel(doc)[0];
		const bookmarksId = before?.columns[2]?.widgets[0]?.id;
		const weerId = before?.columns[0]?.widgets[1]?.id;
		const next = unwrap(
			wrapInSplitColumn(doc, WEER, { kind: "move", path: BOOKMARKS }, "right"),
		);
		const page = getModel(next)[0];
		const split = page?.columns[0]?.widgets[1];
		expect(split?.children.map((child) => child.id)).toEqual([
			weerId,
			bookmarksId,
		]);
		expect(page?.columns[2]?.widgets).toEqual([]);
		// The block scalar and the flow-style links survive, re-indented.
		const text = serializeConfig(next);
		expect(text).toContain(
			'                  {{ $temp := .JSON.Float "current.temperature_2m" }}',
		);
		expect(text).toContain(
			'                      - { title: Sonarr, url: "https://sonarr.example.test" }',
		);
		expect(commentsOf(text)).toEqual(commentsOf(source));
	});

	it("handles a widget moved from just above the target in the same list", () => {
		const next = unwrap(
			wrapInSplitColumn(doc, WEER, { kind: "move", path: CLOCK }, "left"),
		);
		const column = getModel(next)[0]?.columns[0];
		expect(typesOf(column?.widgets)).toEqual(["split-column"]);
		expect(typesOf(column?.widgets[0]?.children)).toEqual([
			"clock",
			"custom-api",
		]);
	});

	it("round-trips byte for byte with unwrapSplitColumn", () => {
		const wrapped = unwrap(
			wrapInSplitColumn(doc, WEER, { kind: "move", path: CLOCK }, "left"),
		);
		const unwrapped = unwrap(
			unwrapSplitColumn(wrapped, [...HOME, "columns", 0, "widgets", 0]),
		);
		expect(serializeConfig(unwrapped)).toBe(source);
		// The ids are back where they started.
		expect(
			getModel(unwrapped)[0]?.columns[0]?.widgets.map((w) => w.id),
		).toEqual(getModel(doc)[0]?.columns[0]?.widgets.map((w) => w.id));
	});

	it("keeps anchors and aliases working", () => {
		const text = [
			"pages:",
			"  - name: Home",
			"    columns:",
			"      - size: full",
			"        widgets:",
			"          - &base # the shared look",
			"            type: rss",
			"            limit: 5",
			"          - <<: *base",
			"            title: Copy",
			"",
		].join("\n");
		const anchored = load(text);
		const next = unwrap(
			wrapInSplitColumn(
				anchored,
				["pages", 0, "columns", 0, "widgets", 0],
				{ kind: "new", widget: { type: "clock" } },
				"right",
			),
		);
		const out = serializeConfig(next);
		expect(out).toContain("              - &base # the shared look");
		expect(out).toContain("          - <<: *base");
	});

	it("wraps a widget alone, for a width with empty space next to it", () => {
		const next = unwrap(wrapInSplitColumn(doc, CLOCK, null, "left", 3));
		expectLineChanges(source, serializeConfig(next), {
			removed: [
				"          - type: clock",
				"            hour-format: 24h",
				"            timezones:",
				"              - timezone: Europe/Amsterdam",
				"                label: Thuis",
			],
			added: [
				"          - type: split-column",
				"            max-columns: 3",
				"            widgets:",
				"              - type: clock",
				"                hour-format: 24h",
				"                timezones:",
				"                  - timezone: Europe/Amsterdam",
				"                    label: Thuis",
			],
		});
		const split = getModel(next)[0]?.columns[0]?.widgets[0];
		expect(split?.children[0]?.id).toBe(
			getModel(doc)[0]?.columns[0]?.widgets[0]?.id,
		);
		expect(unwrapErr(wrapInSplitColumn(doc, CLOCK, null, "left", 1)).code).toBe(
			"invalid-result",
		);
	});

	it("refuses head widgets, groups and putting a widget beside itself", () => {
		expect(
			unwrapErr(
				wrapInSplitColumn(
					doc,
					HEAD_SEARCH,
					{ kind: "new", widget: { type: "clock" } },
					"left",
				),
			).message,
		).toMatch(/Head widgets can't be split/);
		expect(
			unwrapErr(
				wrapInSplitColumn(
					doc,
					[...GROUP, "widgets", 0],
					{ kind: "new", widget: { type: "clock" } },
					"left",
				),
			).code,
		).toBe("layout-violation");
		expect(
			unwrapErr(
				wrapInSplitColumn(doc, CLOCK, { kind: "move", path: CLOCK }, "left"),
			).code,
		).toBe("invalid-move");
		// A split-column can't go beside one of its own children.
		expect(
			unwrapErr(
				wrapInSplitColumn(
					doc,
					[...SPLIT, "widgets", 0],
					{ kind: "move", path: SPLIT },
					"left",
				),
			).code,
		).toBe("invalid-move");
	});
});

describe("addToSplitColumn", () => {
	it("adds a new widget at a position", () => {
		const next = unwrap(
			addToSplitColumn(
				doc,
				SPLIT,
				{ kind: "new", widget: { type: "reddit" } },
				1,
			),
		);
		expect(
			typesOf(getModel(next)[0]?.columns[1]?.widgets[1]?.children),
		).toEqual(["hacker-news", "reddit", "lobsters"]);
	});

	it("moves a widget in, at the end by default", () => {
		const next = unwrap(
			addToSplitColumn(doc, SPLIT, { kind: "move", path: CLOCK }),
		);
		expect(
			typesOf(getModel(next)[0]?.columns[1]?.widgets[1]?.children),
		).toEqual(["hacker-news", "lobsters", "clock"]);
	});

	it("moves a child to the end of its own split-column", () => {
		const next = unwrap(
			addToSplitColumn(doc, SPLIT, {
				kind: "move",
				path: [...SPLIT, "widgets", 0],
			}),
		);
		expect(
			typesOf(getModel(next)[0]?.columns[1]?.widgets[1]?.children),
		).toEqual(["lobsters", "hacker-news"]);
	});

	it("refuses a target that isn't a split-column", () => {
		expect(
			unwrapErr(
				addToSplitColumn(doc, GROUP, { kind: "new", widget: { type: "rss" } }),
			).code,
		).toBe("not-found");
	});
});

describe("unwrapSplitColumn", () => {
	it("puts the children in the split-column's place, comments included", () => {
		const ids = getModel(doc)[0]?.columns[1]?.widgets[1]?.children.map(
			(child) => child.id,
		);
		const next = unwrap(unwrapSplitColumn(doc, SPLIT));
		expectLineChanges(source, serializeConfig(next), {
			removed: [
				"          - type: split-column",
				"            max-columns: 2",
				"            widgets:",
				"              - type: hacker-news",
				"                limit: 10",
				"              - type: lobsters   # second half of the split",
				"                limit: 10",
			],
			added: [
				"          - type: hacker-news",
				"            limit: 10",
				"",
				"          - type: lobsters   # second half of the split",
				"            limit: 10",
			],
		});
		const column = getModel(next)[0]?.columns[1];
		expect(typesOf(column?.widgets)).toEqual([
			"group",
			"hacker-news",
			"lobsters",
			null,
		]);
		expect(column?.widgets.slice(1, 3).map((widget) => widget.id)).toEqual(ids);
	});

	it("moves comment lines above the split-column to its first widget", () => {
		const text = [
			"pages:",
			"  - name: Home",
			"    columns:",
			"      - size: full",
			"        widgets:",
			"          # News, side by side.",
			"          - type: split-column",
			"            widgets:",
			"              - type: hacker-news",
			"              - type: lobsters",
			"",
		].join("\n");
		const next = unwrap(
			unwrapSplitColumn(load(text), ["pages", 0, "columns", 0, "widgets", 0]),
		);
		expect(serializeConfig(next)).toBe(
			[
				"pages:",
				"  - name: Home",
				"    columns:",
				"      - size: full",
				"        widgets:",
				"          # News, side by side.",
				"          - type: hacker-news",
				"          - type: lobsters",
				"",
			].join("\n"),
		);
	});

	it("refuses widgets that aren't split-columns", () => {
		expect(unwrapErr(unwrapSplitColumn(doc, CLOCK)).code).toBe("not-found");
	});
});

describe("setSplitColumns", () => {
	it("changes max-columns in place", () => {
		const next = unwrap(setSplitColumns(doc, SPLIT, 3));
		expectLineChanges(source, serializeConfig(next), {
			removed: ["            max-columns: 2"],
			added: ["            max-columns: 3"],
		});
		expect(getModel(next)[0]?.columns[1]?.widgets[1]?.maxColumns).toBe(3);
	});

	it("refuses fewer than 2 columns and other widgets", () => {
		expect(unwrapErr(setSplitColumns(doc, SPLIT, 1)).code).toBe(
			"invalid-result",
		);
		expect(unwrapErr(setSplitColumns(doc, SPLIT, 2.5)).code).toBe(
			"invalid-result",
		);
		expect(unwrapErr(setSplitColumns(doc, CLOCK, 3)).code).toBe("not-found");
	});
});

describe("Glaze's editing rules", () => {
	it("refuses moving a split-column into head widgets", () => {
		const error = unwrapErr(
			moveWidget(doc, SPLIT, [...HOME, "head-widgets"], 0),
		);
		expect(error.code).toBe("layout-violation");
		expect(error.issues.map((issue) => issue.code)).toEqual(["split-in-head"]);
	});

	it("reports a split-column that is already in head widgets", () => {
		const text = [
			"pages:",
			"  - name: Home",
			"    head-widgets:",
			"      - type: split-column",
			"    columns:",
			"      - size: full",
			"",
		].join("\n");
		expect(
			glazeLayoutIssues(load(text).yaml).map((issue) => issue.path),
		).toEqual([["pages", 0, "head-widgets", 0]]);
	});
});

describe("model: maxColumns", () => {
	it("follows Glance: missing or below 2 counts as 2", () => {
		const text = [
			"pages:",
			"  - name: Home",
			"    columns:",
			"      - size: full",
			"        widgets:",
			"          - type: split-column",
			"          - type: split-column",
			"            max-columns: 1",
			"          - type: split-column",
			"            max-columns: 4",
			"          - type: clock",
			"",
		].join("\n");
		expect(
			getModel(load(text))[0]?.columns[0]?.widgets.map((w) => w.maxColumns),
		).toEqual([2, 2, 4, null]);
	});
});

describe("columnSizeProblem", () => {
	it("explains the full-column rule before an edit is tried", () => {
		expect(columnSizeProblem(["small", "full", "small"], 0, "full")).toBeNull();
		expect(columnSizeProblem(["small", "full", "small"], 1, "small")).toMatch(
			/at least one full column/,
		);
		expect(columnSizeProblem(["full", "full", "small"], 2, "full")).toMatch(
			/at most two full columns/,
		);
	});
});
