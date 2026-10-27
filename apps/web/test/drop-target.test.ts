import { describe, expect, it } from "vitest";
import type { ListGeometry } from "../src/lib/dnd-geometry.ts";
import type { PageNode, WidgetNode } from "@glaze/core";
import {
	acceptsDrop,
	type DragSubject,
	isArrowKey,
	isNoOp,
	listsOfPage,
	locateWidget,
	nextKeyboardTarget,
	pointerTarget,
	toCoreIndex,
	type WidgetList,
} from "../src/lib/drop-target.ts";

const LISTS: WidgetList[] = [
	{
		id: "head:p1",
		kind: "head",
		path: ["pages", 0, "head-widgets"],
		widgetIds: [],
		label: "head widgets",
		ownerIds: [],
	},
	{
		id: "c1",
		kind: "column",
		path: ["pages", 0, "columns", 0, "widgets"],
		widgetIds: ["a", "b", "c"],
		label: "column 1",
		ownerIds: [],
	},
	{
		id: "c2",
		kind: "column",
		path: ["pages", 0, "columns", 1, "widgets"],
		widgetIds: ["d"],
		label: "column 2",
		ownerIds: [],
	},
];

/** A new clock from the library. */
const NEW: DragSubject = { type: "clock", widgetId: null };

const rect = (top: number, height = 40, left = 0, width = 200) => ({
	top,
	left,
	width,
	height,
	bottom: top + height,
	right: left + width,
});

// Column 1 at x 0..200 with widgets a, b, c (40px tall, 8px apart), column 2
// at x 220..420 with widget d. Head widgets are a strip above both.
const GEOMETRY: ListGeometry[] = [
	{ id: "head:p1", layout: "row", rect: rect(-60, 50, 0, 420), items: [] },
	{
		id: "c1",
		layout: "stack",
		rect: rect(0, 300),
		items: [rect(0), rect(48), rect(96)],
	},
	{
		id: "c2",
		layout: "stack",
		rect: rect(0, 300, 220),
		items: [rect(0, 40, 220)],
	},
];

describe("pointerTarget", () => {
	it("drops before a widget, or after it below its middle", () => {
		expect(pointerTarget(LISTS, GEOMETRY, { x: 50, y: 55 }, null, NEW)).toEqual(
			{
				listId: "c1",
				index: 1,
			},
		);
		expect(pointerTarget(LISTS, GEOMETRY, { x: 50, y: 80 }, null, NEW)).toEqual(
			{
				listId: "c1",
				index: 2,
			},
		);
	});

	it("keeps the slot in the gap between two widgets instead of jumping to the end", () => {
		// y 42..46 is the gap between a and b: still "between a and b".
		expect(pointerTarget(LISTS, GEOMETRY, { x: 50, y: 44 }, null, NEW)).toEqual(
			{
				listId: "c1",
				index: 1,
			},
		);
	});

	it("drops at the end below the last widget, also in an empty list", () => {
		expect(
			pointerTarget(LISTS, GEOMETRY, { x: 50, y: 250 }, null, NEW),
		).toEqual({
			listId: "c1",
			index: 3,
		});
		expect(
			pointerTarget(LISTS, GEOMETRY, { x: 50, y: -30 }, null, NEW),
		).toEqual({
			listId: "head:p1",
			index: 0,
		});
	});

	it("is null outside every list or over an unknown list", () => {
		expect(
			pointerTarget(LISTS, GEOMETRY, { x: 210, y: 50 }, null, NEW),
		).toBeNull();
		const unknown: ListGeometry = {
			id: "zz",
			layout: "stack",
			rect: rect(0, 300),
			items: [],
		};
		expect(
			pointerTarget(LISTS, [unknown], { x: 50, y: 50 }, null, NEW),
		).toBeNull();
	});

	it("doesn't toggle when the pointer wobbles around a midpoint", () => {
		// b's middle is at y 68. Start just below it: slot 2.
		let target = pointerTarget(LISTS, GEOMETRY, { x: 50, y: 70 }, null, NEW);
		expect(target).toEqual({ listId: "c1", index: 2 });
		for (const y of [67, 64, 69, 62, 71, 66, 60]) {
			target = pointerTarget(LISTS, GEOMETRY, { x: 50, y }, target, NEW);
			expect(target).toEqual({ listId: "c1", index: 2 });
		}
		// Clearly above the middle (more than the hysteresis margin): slot 1.
		target = pointerTarget(LISTS, GEOMETRY, { x: 50, y: 57 }, target, NEW);
		expect(target).toEqual({ listId: "c1", index: 1 });
		for (const y of [70, 75, 77]) {
			target = pointerTarget(LISTS, GEOMETRY, { x: 50, y }, target, NEW);
			expect(target).toEqual({ listId: "c1", index: 1 });
		}
	});

	it("starts fresh, without hysteresis, in another list", () => {
		const previous = { listId: "c1", index: 3 };
		expect(
			pointerTarget(LISTS, GEOMETRY, { x: 300, y: 25 }, previous, NEW),
		).toEqual({
			listId: "c2",
			index: 1,
		});
	});
});

describe("isNoOp and toCoreIndex", () => {
	const source = locateWidget(LISTS, "a");

	it("finds a widget's position", () => {
		expect(source).toEqual({ listId: "c1", index: 0 });
		expect(locateWidget(LISTS, "nope")).toBeNull();
	});

	it("treats dropping right before or after itself as no change", () => {
		expect(isNoOp(source, { listId: "c1", index: 0 })).toBe(true);
		expect(isNoOp(source, { listId: "c1", index: 1 })).toBe(true);
		expect(isNoOp(source, { listId: "c1", index: 2 })).toBe(false);
		expect(isNoOp(source, { listId: "c2", index: 0 })).toBe(false);
		expect(isNoOp(null, { listId: "c1", index: 0 })).toBe(false);
	});

	it("subtracts one when moving down within the same list", () => {
		// "a" dropped before "c" (screen index 2) ends up at index 1 once it is taken out.
		expect(toCoreIndex(source, { listId: "c1", index: 2 })).toBe(1);
		expect(toCoreIndex(source, { listId: "c1", index: 3 })).toBe(2);
	});

	it("keeps the index when moving up, to another list, or from the library", () => {
		const c = locateWidget(LISTS, "c");
		expect(toCoreIndex(c, { listId: "c1", index: 0 })).toBe(0);
		expect(toCoreIndex(source, { listId: "c2", index: 1 })).toBe(1);
		expect(toCoreIndex(null, { listId: "c2", index: 0 })).toBe(0);
	});
});

describe("nextKeyboardTarget", () => {
	const source = locateWidget(LISTS, "a"); // c1, index 0

	it("starts in the first column for a library item", () => {
		expect(nextKeyboardTarget(LISTS, null, null, "ArrowRight")).toEqual({
			listId: "c1",
			index: 0,
		});
	});

	it("moves one step in a column, skipping the second no-change spot", () => {
		// From "on itself" (index 0), index 1 changes nothing either, so go to 2.
		expect(
			nextKeyboardTarget(
				LISTS,
				{ listId: "c1", index: 0 },
				source,
				"ArrowDown",
			),
		).toEqual({ listId: "c1", index: 2 });
		expect(
			nextKeyboardTarget(
				LISTS,
				{ listId: "c1", index: 2 },
				source,
				"ArrowDown",
			),
		).toEqual({ listId: "c1", index: 3 });
		expect(
			nextKeyboardTarget(
				LISTS,
				{ listId: "c1", index: 3 },
				source,
				"ArrowDown",
			),
		).toBeNull();
	});

	it("goes from the top of a column to the end of the head widgets and back", () => {
		const head = nextKeyboardTarget(
			LISTS,
			{ listId: "c2", index: 0 },
			null,
			"ArrowUp",
		);
		expect(head).toEqual({ listId: "head:p1", index: 0 });
		expect(nextKeyboardTarget(LISTS, head, null, "ArrowDown")).toEqual({
			listId: "c1",
			index: 0,
		});
		expect(nextKeyboardTarget(LISTS, head, null, "ArrowUp")).toBeNull();
	});

	it("jumps between columns, clamping the position", () => {
		expect(
			nextKeyboardTarget(LISTS, { listId: "c1", index: 3 }, null, "ArrowRight"),
		).toEqual({ listId: "c2", index: 1 });
		expect(
			nextKeyboardTarget(LISTS, { listId: "c2", index: 1 }, null, "ArrowLeft"),
		).toEqual({ listId: "c1", index: 1 });
		expect(
			nextKeyboardTarget(LISTS, { listId: "c2", index: 0 }, null, "ArrowRight"),
		).toBeNull();
	});

	it("recognises arrow keys", () => {
		expect(isArrowKey("ArrowLeft")).toBe(true);
		expect(isArrowKey("Space")).toBe(false);
	});
});

const widget = (
	id: string,
	type: string,
	path: (string | number)[],
	children: WidgetNode[] = [],
	maxColumns: number | null = null,
): WidgetNode => ({
	id,
	path,
	type,
	title: null,
	isAlias: false,
	include: null,
	children,
	maxColumns,
});

// Column 1 holds a split-column (with a group inside it) and a clock.
const COL = ["pages", 0, "columns", 0, "widgets"] as const;
const PAGE: PageNode = {
	id: "p1",
	path: ["pages", 0],
	name: "Home",
	slug: null,
	width: null,
	include: null,
	headWidgets: [widget("h1", "search", ["pages", 0, "head-widgets", 0])],
	columns: [
		{
			id: "c1",
			path: ["pages", 0, "columns", 0],
			size: "full",
			widgets: [
				widget(
					"s1",
					"split-column",
					[...COL, 0],
					[
						widget("n1", "rss", [...COL, 0, "widgets", 0]),
						widget(
							"g1",
							"group",
							[...COL, 0, "widgets", 1],
							[widget("t1", "rss", [...COL, 0, "widgets", 1, "widgets", 0])],
						),
					],
					3,
				),
				widget("w2", "clock", [...COL, 1]),
			],
		},
	],
};

describe("listsOfPage", () => {
	it("adds the split-columns and groups inside a column, with their owners", () => {
		const lists = listsOfPage(PAGE);
		expect(lists.map((list) => [list.id, list.kind, list.ownerIds])).toEqual([
			["head:p1", "head", []],
			["c1", "column", []],
			["split:s1", "split", ["s1"]],
			["group:g1", "group", ["s1", "g1"]],
		]);
		expect(lists[2]?.path).toEqual([...COL, 0, "widgets"]);
		expect(lists[2]?.widgetIds).toEqual(["n1", "g1"]);
		// Nested widgets can be found, e.g. to start a drag from them.
		expect(locateWidget(lists, "g1")).toEqual({ listId: "split:s1", index: 1 });
	});
});

describe("acceptsDrop", () => {
	const [head, column, split, group] = listsOfPage(PAGE);

	it("follows Glance: no group or split-column inside a group", () => {
		if (!group) throw new Error("no group list");
		expect(acceptsDrop(group, { type: "rss", widgetId: null })).toBe(true);
		expect(acceptsDrop(group, { type: "group", widgetId: null })).toBe(false);
		expect(acceptsDrop(group, { type: "split-column", widgetId: "x" })).toBe(
			false,
		);
	});

	it("keeps split-columns out of head widgets", () => {
		if (!head || !column) throw new Error("no lists");
		expect(acceptsDrop(head, { type: "split-column", widgetId: "s1" })).toBe(
			false,
		);
		expect(acceptsDrop(head, { type: "clock", widgetId: "w2" })).toBe(true);
		expect(acceptsDrop(column, { type: "split-column", widgetId: "s1" })).toBe(
			true,
		);
	});

	it("never drops a container inside itself", () => {
		if (!split || !group) throw new Error("no lists");
		expect(acceptsDrop(split, { type: "split-column", widgetId: "s1" })).toBe(
			false,
		);
		expect(acceptsDrop(group, { type: "group", widgetId: "g1" })).toBe(false);
		expect(acceptsDrop(split, { type: "rss", widgetId: "w2" })).toBe(true);
	});
});

describe("pointerTarget: beside", () => {
	// Widgets in c1 are 200 wide, so the beside bands are 44px on each edge.
	it("targets the left or right edge of a widget in a column", () => {
		expect(pointerTarget(LISTS, GEOMETRY, { x: 20, y: 60 }, null, NEW)).toEqual(
			{
				listId: "c1",
				index: 1,
				side: "left",
			},
		);
		expect(
			pointerTarget(LISTS, GEOMETRY, { x: 190, y: 60 }, null, NEW),
		).toEqual({
			listId: "c1",
			index: 1,
			side: "right",
		});
	});

	it("never offers a widget's own edges", () => {
		const own: DragSubject = { type: "clock", widgetId: "b" };
		expect(pointerTarget(LISTS, GEOMETRY, { x: 20, y: 60 }, null, own)).toEqual(
			{
				listId: "c1",
				index: 1,
			},
		);
	});

	it("keeps the beside target while the pointer wobbles on the band's edge", () => {
		let target = pointerTarget(LISTS, GEOMETRY, { x: 40, y: 60 }, null, NEW);
		for (const x of [45, 48, 52, 44, 55]) {
			target = pointerTarget(LISTS, GEOMETRY, { x, y: 60 }, target, NEW);
			expect(target).toEqual({ listId: "c1", index: 1, side: "left" });
		}
		target = pointerTarget(LISTS, GEOMETRY, { x: 70, y: 60 }, target, NEW);
		expect(target).toEqual({ listId: "c1", index: 1 });
	});

	it("isn't a no-op, even next to the dragged widget's own slot", () => {
		const source = { listId: "c1", index: 0 };
		expect(isNoOp(source, { listId: "c1", index: 1, side: "left" })).toBe(
			false,
		);
	});
});
