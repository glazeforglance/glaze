import { describe, expect, it } from "vitest";
import {
	getModel,
	moveWidget,
	type PageNode,
	type WidgetNode,
} from "../src/index.ts";
import { load, FULL_FIXTURE, unwrap } from "./helpers/line-diff.ts";

const doc = load(FULL_FIXTURE);

function allIds(pages: readonly PageNode[]): string[] {
	const fromWidgets = (widgets: readonly WidgetNode[]): string[] =>
		widgets.flatMap((widget) => [widget.id, ...fromWidgets(widget.children)]);
	return pages.flatMap((page) => [
		page.id,
		...fromWidgets(page.headWidgets),
		...page.columns.flatMap((column) => [
			column.id,
			...fromWidgets(column.widgets),
		]),
	]);
}

describe("getModel", () => {
	const pages = getModel(doc);

	it("reads pages with name, slug and width", () => {
		expect(
			pages.map(({ name, slug, width }) => ({ name, slug, width })),
		).toEqual([
			{ name: "Home", slug: "home", width: "wide" },
			{ name: "Server", slug: "server", width: null },
			{ name: "Lab", slug: null, width: "slim" },
		]);
	});

	it("reads columns and their sizes", () => {
		expect(
			pages.map((page) => page.columns.map((column) => column.size)),
		).toEqual([
			["small", "full", "small"],
			["full", "small"],
			["full", "small"],
		]);
		expect(pages[0]?.columns[1]?.path).toEqual(["pages", 0, "columns", 1]);
	});

	it("reads head-widgets", () => {
		expect(pages[0]?.headWidgets).toMatchObject([
			{ type: "search", path: ["pages", 0, "head-widgets", 0] },
		]);
	});

	it("reads group tabs, resolving merge keys", () => {
		const group = pages[0]?.columns[1]?.widgets[0];
		expect(group?.type).toBe("group");
		expect(group?.children.map(({ type, title }) => ({ type, title }))).toEqual(
			[
				{ type: "custom-api", title: "Alles" },
				{ type: "custom-api", title: "Series" },
				{ type: "custom-api", title: "Anime" },
			],
		);
		expect(group?.children[2]?.path).toEqual([
			"pages",
			0,
			"columns",
			1,
			"widgets",
			0,
			"widgets",
			2,
		]);
	});

	it("reads split-column children and include items", () => {
		const [, split, include] = pages[0]?.columns[1]?.widgets ?? [];
		expect(split?.children.map((child) => child.type)).toEqual([
			"hacker-news",
			"lobsters",
		]);
		expect(include).toMatchObject({
			type: null,
			include: "widgets/immich.yml",
		});
	});

	it("gives every node a unique id, the same on every call", () => {
		const ids = allIds(pages);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.every((id) => id.length > 0)).toBe(true);
		expect(allIds(getModel(doc))).toEqual(ids);
	});

	it("keeps ids when a widget moves", () => {
		const monitor = getModel(doc)[1]?.columns[0]?.widgets[0];
		const moved = unwrap(
			moveWidget(
				doc,
				["pages", 1, "columns", 0, "widgets", 0],
				["pages", 2, "columns", 1, "widgets"],
				0,
			),
		);
		const target = getModel(moved)[2]?.columns[1]?.widgets[0];
		expect(target?.type).toBe("monitor");
		expect(target?.id).toBe(monitor?.id);
		// The widget that slid up into the monitor's old place keeps its own id.
		expect(getModel(moved)[1]?.columns[0]?.widgets[0]?.id).toBe(
			getModel(doc)[1]?.columns[0]?.widgets[1]?.id,
		);
	});
});
