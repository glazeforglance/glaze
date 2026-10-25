import { describe, expect, it } from "vitest";
import {
	addColumn,
	getModel,
	removeColumn,
	serializeConfig,
	setColumnSize,
} from "../src/index.ts";
import {
	expectLineChanges,
	load,
	FULL_FIXTURE,
	unwrap,
	unwrapErr,
} from "./helpers/line-diff.ts";

const source = FULL_FIXTURE;
const doc = load(source);

describe("addColumn", () => {
	it("appends a column in the page's own style", () => {
		const next = serializeConfig(unwrap(addColumn(doc, ["pages", 1], "small")));
		expectLineChanges(source, next, {
			removed: [],
			added: ["      - size: small", ""],
		});
		expect(next).toContain(
			"                name: ZimaOS\n\n      - size: small\n\n  - name: Lab\n",
		);
	});

	it("inserts a column at an index", () => {
		const next = unwrap(addColumn(doc, ["pages", 1], "small", 0));
		expect(getModel(next)[1]?.columns.map((column) => column.size)).toEqual([
			"small",
			"full",
			"small",
		]);
	});

	it("refuses a fourth column", () => {
		const error = unwrapErr(addColumn(doc, ["pages", 0], "small"));
		expect(error.code).toBe("layout-violation");
		expect(error.issues.map((issue) => issue.code)).toEqual([
			"too-many-columns",
		]);
	});

	it("refuses a third column on a slim page", () => {
		expect(
			unwrapErr(addColumn(doc, ["pages", 2], "small")).issues[0]?.code,
		).toBe("too-many-columns");
	});

	it("refuses a third full column", () => {
		const twoFull = unwrap(
			setColumnSize(doc, ["pages", 1, "columns", 1], "full"),
		);
		expect(
			unwrapErr(addColumn(twoFull, ["pages", 1], "full")).issues[0]?.code,
		).toBe("full-column-count");
	});
});

describe("removeColumn", () => {
	it("removes the column with its widgets", () => {
		const next = serializeConfig(
			unwrap(removeColumn(doc, ["pages", 0, "columns", 2])),
		);
		expectLineChanges(source, next, {
			removed: [
				"      - size: small",
				"        widgets:",
				"          - type: bookmarks",
				"            groups:",
				"              - title: Media",
				"                links:",
				'                  - { title: Sonarr, url: "https://sonarr.example.test" }',
				'                  - { title: Radarr, url: "https://radarr.example.test" }',
				"",
			],
			added: [],
		});
		expect(next).toContain(
			"          - $include: widgets/immich.yml\n\n  # Server status.\n",
		);
	});

	it("refuses to remove the only full column", () => {
		const error = unwrapErr(removeColumn(doc, ["pages", 1, "columns", 0]));
		expect(error.code).toBe("layout-violation");
		expect(error.issues[0]?.code).toBe("full-column-count");
	});

	it("refuses to remove the last column", () => {
		const single = load(
			"pages:\n  - name: A\n    columns:\n      - size: full\n",
		);
		expect(
			unwrapErr(removeColumn(single, ["pages", 0, "columns", 0])).issues[0]
				?.code,
		).toBe("no-columns");
	});
});

describe("setColumnSize", () => {
	it("changes only the size line", () => {
		const next = serializeConfig(
			unwrap(setColumnSize(doc, ["pages", 0, "columns", 0], "full")),
		);
		expectLineChanges(source, next, {
			removed: ["      - size: small"],
			added: ["      - size: full"],
		});
	});

	it("refuses to leave a page without a full column", () => {
		expect(
			unwrapErr(setColumnSize(doc, ["pages", 1, "columns", 0], "small"))
				.issues[0]?.code,
		).toBe("full-column-count");
	});

	it("rejects a path that is not a column", () => {
		expect(unwrapErr(setColumnSize(doc, ["pages", 0], "full")).code).toBe(
			"invalid-path",
		);
	});
});
