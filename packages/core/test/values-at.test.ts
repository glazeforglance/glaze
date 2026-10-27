import { describe, expect, it } from "vitest";
import {
	getMapOptions,
	insertListItemAt,
	removeValueAt,
	serializeConfig,
	setValueAt,
	slugFromName,
	slugProblem,
} from "../src/index.ts";
import {
	expectLineChanges,
	FULL_FIXTURE,
	load,
	unwrap,
	unwrapErr,
} from "./helpers/line-diff.ts";

const source = FULL_FIXTURE;
const doc = load(source);

describe("value edits on a page", () => {
	it("sets and removes a page option, keeping everything else", () => {
		const next = unwrap(
			setValueAt(doc, ["pages", 1], ["center-vertically"], true),
		);
		expectLineChanges(source, serializeConfig(next), {
			removed: [],
			added: ["    center-vertically: true"],
		});
		const back = unwrap(
			removeValueAt(next, ["pages", 1], ["center-vertically"]),
		);
		expect(serializeConfig(back)).toBe(source);
	});

	it("changes a page's width in place", () => {
		const next = unwrap(setValueAt(doc, ["pages", 0], ["width"], "default"));
		expectLineChanges(source, serializeConfig(next), {
			removed: ["    width: wide"],
			added: ["    width: default"],
		});
	});

	it("refuses columns and head widgets, which have their own edits", () => {
		expect(unwrapErr(setValueAt(doc, ["pages", 0], ["columns"], [])).code).toBe(
			"invalid-path",
		);
		expect(
			unwrapErr(
				setValueAt(doc, ["pages", 0], ["head-widgets", 0, "title"], "x"),
			).code,
		).toBe("invalid-path");
	});

	it("still runs the layout check (a slim page has at most 2 columns)", () => {
		const threeColumns = load(
			"pages:\n  - name: Home\n    columns:\n      - size: full\n      - size: small\n      - size: small\n",
		);
		expect(
			unwrapErr(setValueAt(threeColumns, ["pages", 0], ["width"], "slim")).code,
		).toBe("layout-violation");
	});
});

describe("value edits on the document root", () => {
	it("edits a value inside a top-level section, comments included", () => {
		const next = unwrap(setValueAt(doc, [], ["server", "port"], 8081));
		expectLineChanges(source, serializeConfig(next), {
			removed: ["  port: 8080            # aligned trailing comment"],
			added: ["  port: 8081            # aligned trailing comment"],
		});
	});

	it("adds a missing section", () => {
		const next = unwrap(setValueAt(doc, [], ["branding", "logo-text"], "H"));
		expect(serializeConfig(next).endsWith("branding:\n  logo-text: H\n")).toBe(
			true,
		);
	});

	it("adds a theme preset into a map", () => {
		const next = unwrap(
			setValueAt(doc, [], ["theme", "presets", "dark"], {
				"background-color": "240 13 14",
			}),
		);
		expect(serializeConfig(next)).toContain(
			"  presets:\n    dark:\n      background-color: 240 13 14\n",
		);
	});

	it("adds an item to a list in a section", () => {
		const text =
			"server:\n  port: 8080\nlist:\n  - a\npages:\n  - name: Home\n    columns:\n      - size: full\n";
		const next = unwrap(insertListItemAt(load(text), [], ["list"], "b"));
		expect(serializeConfig(next)).toContain("list:\n  - a\n  - b\n");
	});

	it("refuses pages, which have their own edits", () => {
		expect(unwrapErr(setValueAt(doc, [], ["pages"], [])).code).toBe(
			"invalid-path",
		);
	});

	it("reads every key of a map", () => {
		const page = unwrap(getMapOptions(doc, ["pages", 0]));
		expect([...page.options.keys()]).toEqual([
			"name",
			"slug",
			"width",
			"head-widgets",
			"columns",
		]);
		const root = unwrap(getMapOptions(doc, []));
		expect(root.options.get("server")?.value).toEqual({
			port: 8080,
			proxied: true,
			"assets-path": "/app/assets",
		});
	});

	it("refuses a base that isn't the root, a page or a widget", () => {
		expect(unwrapErr(setValueAt(doc, ["server"], ["port"], 1)).code).toBe(
			"invalid-path",
		);
	});
});

describe("slugs", () => {
	it("follows Glance's titleToSlug", () => {
		expect(slugFromName("My  Home Page ")).toBe("my-home-page");
		expect(slugFromName(" -Lab- ")).toBe("lab");
	});

	it("explains reserved and duplicate slugs", () => {
		const pages = [
			{ name: "Home", slug: null },
			{ name: "Other", slug: "home" },
			{ name: "Login", slug: null },
			{ name: "Lab", slug: null },
		];
		expect(slugProblem(pages, 1)).toMatch(
			/Page 1 already uses the URL path "home"/,
		);
		expect(slugProblem(pages, 2)).toMatch(/"login" is reserved/);
		expect(slugProblem(pages, 3)).toBeNull();
	});
});
