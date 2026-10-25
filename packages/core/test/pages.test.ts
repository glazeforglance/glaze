import { describe, expect, it } from "vitest";
import {
	addPage,
	getModel,
	movePage,
	removePage,
	renamePage,
	serializeConfig,
} from "../src/index.ts";
import {
	diffLines,
	expectLineChanges,
	load,
	FULL_FIXTURE,
	unwrap,
	unwrapErr,
} from "./helpers/line-diff.ts";

const source = FULL_FIXTURE;
const doc = load(source);

const LAB_PAGE = [
	"  - name: Lab",
	"    width: slim",
	"    columns:",
	"      - size: full",
	"        widgets:",
	"          - type: rss",
	"            limit: 5",
	'            feeds: [ { url: "https://selfh.st/rss/" } ]   # flow style on purpose',
	"",
	"      - size: small",
	"        widgets:",
	"          - type: releases",
	"            repositories:",
	"              - glanceapp/glance",
	"              - immich-app/immich",
	"            token: ${GITHUB_TOKEN}",
];

describe("addPage", () => {
	it("appends a page with one full column", () => {
		const next = unwrap(addPage(doc, "Media"));
		expect(
			serializeConfig(next).endsWith(
				"    token: ${GITHUB_TOKEN}\n\n  - name: Media\n    columns:\n      - size: full\n",
			),
		).toBe(true);
		expectLineChanges(source, serializeConfig(next), {
			removed: [],
			added: ["  - name: Media", "    columns:", "      - size: full", ""],
		});
		expect(getModel(next).map((page) => page.name)).toEqual([
			"Home",
			"Server",
			"Lab",
			"Media",
		]);
	});

	it("inserts a page before an existing one, above its comment", () => {
		const next = serializeConfig(unwrap(addPage(doc, "Media", 0)));
		expect(next).toContain(
			"pages:\n  - name: Media\n    columns:\n      - size: full\n\n  # The landing page.\n  - name: Home\n",
		);
	});

	it("creates the pages list when there is none", () => {
		const next = unwrap(addPage(load("server:\n  port: 8080\n"), "Home"));
		expect(serializeConfig(next)).toBe(
			"server:\n  port: 8080\npages:\n  - name: Home\n    columns:\n      - size: full\n",
		);
	});
});

describe("renamePage", () => {
	it("changes only the name line", () => {
		const next = serializeConfig(
			unwrap(renamePage(doc, ["pages", 0], "Start")),
		);
		expectLineChanges(source, next, {
			removed: ["  - name: Home"],
			added: ["  - name: Start"],
		});
	});

	it("quotes names that need it", () => {
		const next = serializeConfig(
			unwrap(renamePage(doc, ["pages", 1], "Server: status")),
		);
		expectLineChanges(source, next, {
			removed: ["  - name: Server"],
			added: ['  - name: "Server: status"'],
		});
	});

	it("rejects a path that is not a page", () => {
		expect(
			unwrapErr(renamePage(doc, ["pages", 0, "columns", 0], "x")).code,
		).toBe("invalid-path");
		expect(unwrapErr(renamePage(doc, ["pages", 9], "x")).code).toBe(
			"not-found",
		);
	});
});

describe("removePage", () => {
	it("removes the page and the blank line before it", () => {
		const next = serializeConfig(unwrap(removePage(doc, ["pages", 2])));
		expectLineChanges(source, next, { removed: [...LAB_PAGE, ""], added: [] });
		expect(
			next.endsWith(
				"              - type: local\n                name: ZimaOS\n",
			),
		).toBe(true);
	});

	it("removes the page's leading comment with it", () => {
		const next = serializeConfig(unwrap(removePage(doc, ["pages", 1])));
		const diff = diffLines(source, next);
		expect(diff.added).toEqual([]);
		expect(diff.removed.slice(0, 2)).toEqual([
			"  # Server status.",
			"  - name: Server",
		]);
		expect(next).toContain(
			'                  - { title: Radarr, url: "https://radarr.example.test" }\n\n  - name: Lab\n',
		);
	});

	it("refuses to remove the last page", () => {
		const single = load(
			"pages:\n  - name: Home\n    columns:\n      - size: full\n",
		);
		const error = unwrapErr(removePage(single, ["pages", 0]));
		expect(error.code).toBe("layout-violation");
		expect(error.issues.map((issue) => issue.code)).toEqual(["no-pages"]);
	});
});

describe("movePage", () => {
	it("moves the page with its comments and keeps every line", () => {
		const next = serializeConfig(unwrap(movePage(doc, ["pages", 2], 0)));
		expect(getModel(load(next)).map((page) => page.name)).toEqual([
			"Lab",
			"Home",
			"Server",
		]);
		expect(next).toContain(
			`pages:\n${LAB_PAGE.join("\n")}\n\n  # The landing page.\n  - name: Home\n`,
		);
		expect(next.split("\n").sort()).toEqual(source.split("\n").sort());
	});

	it("rejects an index outside the list", () => {
		expect(unwrapErr(movePage(doc, ["pages", 0], 3)).code).toBe(
			"index-out-of-range",
		);
	});
});
