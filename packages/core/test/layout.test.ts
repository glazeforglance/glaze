import { describe, expect, it } from "vitest";
import { type LayoutIssueCode, validateLayout } from "../src/index.ts";
import { load, FULL_FIXTURE } from "./helpers/line-diff.ts";

/** Builds a one-page config from column lines and returns the issue codes. */
function codes(yaml: string): LayoutIssueCode[] {
	return validateLayout(load(yaml)).map((issue) => issue.code);
}

function page(columns: string, extra = ""): string {
	return `pages:\n  - name: Test\n${extra}    columns:\n${columns}`;
}

const FULL = "      - size: full\n";
const SMALL = "      - size: small\n";

describe("validateLayout", () => {
	it("accepts the full fixture", () => {
		expect(validateLayout(load(FULL_FIXTURE))).toEqual([]);
	});

	describe("at least one page", () => {
		it("passes with one page", () => expect(codes(page(FULL))).toEqual([]));
		it("fails without pages", () =>
			expect(codes("server:\n  port: 8080\n")).toEqual(["no-pages"]));
		it("fails with an empty list", () =>
			expect(codes("pages: []\n")).toEqual(["no-pages"]));
	});

	describe("at least one column", () => {
		it("passes with one column", () => expect(codes(page(FULL))).toEqual([]));
		it("fails without columns", () => {
			expect(codes("pages:\n  - name: Test\n")).toEqual(["no-columns"]);
			expect(codes("pages:\n  - name: Test\n    columns: []\n")).toEqual([
				"no-columns",
			]);
		});
	});

	describe("at most 3 columns", () => {
		it("passes with 3", () =>
			expect(codes(page(SMALL + FULL + SMALL))).toEqual([]));
		it("fails with 4", () =>
			expect(codes(page(SMALL + FULL + SMALL + SMALL))).toEqual([
				"too-many-columns",
			]));
	});

	describe("at most 2 columns on a slim page", () => {
		const slim = "    width: slim\n";
		it("passes with 2", () =>
			expect(codes(page(SMALL + FULL, slim))).toEqual([]));
		it("fails with 3", () => {
			const issues = validateLayout(load(page(SMALL + FULL + SMALL, slim)));
			expect(issues).toMatchObject([
				{ code: "too-many-columns", path: ["pages", 0, "columns"] },
			]);
		});
	});

	describe("size is small or full", () => {
		it("passes with small and full", () =>
			expect(codes(page(SMALL + FULL))).toEqual([]));
		it("fails with another value", () => {
			const issues = validateLayout(
				load(page(`      - size: medium\n${FULL}`)),
			);
			expect(issues).toMatchObject([
				{ code: "invalid-column-size", path: ["pages", 0, "columns", 0] },
			]);
		});
		it("fails without a size", () =>
			expect(codes(page(`      - widgets: []\n${FULL}`))).toEqual([
				"invalid-column-size",
			]));
	});

	describe("1 or 2 full columns", () => {
		it("passes with 1", () => expect(codes(page(SMALL + FULL))).toEqual([]));
		it("passes with 2", () => expect(codes(page(FULL + FULL))).toEqual([]));
		it("fails with 0", () =>
			expect(codes(page(SMALL + SMALL))).toEqual(["full-column-count"]));
		it("fails with 3", () =>
			expect(codes(page(FULL + FULL + FULL))).toEqual(["full-column-count"]));
	});

	describe("no group or split-column inside a group", () => {
		const column = (children: string) =>
			page(
				`      - size: full\n        widgets:\n          - type: group\n            widgets:\n${children}`,
			);
		it("passes with plain widgets in a group", () => {
			expect(
				codes(
					column("              - type: rss\n              - type: clock\n"),
				),
			).toEqual([]);
		});
		it("passes with a group inside a split-column", () => {
			const split = page(
				"      - size: full\n        widgets:\n          - type: split-column\n            widgets:\n              - type: group\n",
			);
			expect(codes(split)).toEqual([]);
		});
		it("fails with a group in a group", () => {
			const issues = validateLayout(
				load(column("              - type: group\n")),
			);
			expect(issues).toMatchObject([
				{
					code: "nested-group",
					path: ["pages", 0, "columns", 0, "widgets", 0, "widgets", 0],
				},
			]);
		});
		it("fails with a split-column in a group", () => {
			expect(codes(column("              - type: split-column\n"))).toEqual([
				"nested-group",
			]);
		});
	});

	it("skips pages that come from $include", () => {
		expect(codes("pages:\n  - $include: pages/home.yml\n")).toEqual([]);
	});
});
