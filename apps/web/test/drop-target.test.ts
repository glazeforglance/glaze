import { describe, expect, it } from "vitest";
import {
	coordinatesBefore,
	endDropId,
	listDropId,
	toOverItem,
} from "../src/lib/dnd-geometry.ts";
import {
	isArrowKey,
	isNoOp,
	locateWidget,
	nextKeyboardTarget,
	targetFromOver,
	toCoreIndex,
	type WidgetList,
} from "../src/lib/drop-target.ts";

const LISTS: WidgetList[] = [
	{
		id: "head:p1",
		path: ["pages", 0, "head-widgets"],
		widgetIds: [],
		label: "head widgets",
	},
	{
		id: "c1",
		path: ["pages", 0, "columns", 0, "widgets"],
		widgetIds: ["a", "b", "c"],
		label: "column 1",
	},
	{
		id: "c2",
		path: ["pages", 0, "columns", 1, "widgets"],
		widgetIds: ["d"],
		label: "column 2",
	},
];

const rect = (top: number, height = 40, left = 0, width = 200) => ({
	top,
	left,
	width,
	height,
	bottom: top + height,
	right: left + width,
});

describe("targetFromOver", () => {
	it("drops before a widget, or after it over its lower half", () => {
		expect(
			targetFromOver(LISTS, { kind: "widget", id: "b", below: false }),
		).toEqual({ listId: "c1", index: 1 });
		expect(
			targetFromOver(LISTS, { kind: "widget", id: "b", below: true }),
		).toEqual({ listId: "c1", index: 2 });
	});

	it("drops at the end of a list, also an empty one", () => {
		expect(targetFromOver(LISTS, { kind: "list", id: "c1" })).toEqual({
			listId: "c1",
			index: 3,
		});
		expect(targetFromOver(LISTS, { kind: "list", id: "head:p1" })).toEqual({
			listId: "head:p1",
			index: 0,
		});
	});

	it("ignores unknown ids", () => {
		expect(
			targetFromOver(LISTS, { kind: "widget", id: "zz", below: false }),
		).toBeNull();
		expect(targetFromOver(LISTS, { kind: "list", id: "zz" })).toBeNull();
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

describe("toOverItem", () => {
	it("reads list and end-zone ids as the end of that list", () => {
		expect(toOverItem(listDropId("c1"), rect(0), null, "y")).toEqual({
			kind: "list",
			id: "c1",
		});
		expect(toOverItem(endDropId("c2"), rect(0), null, "y")).toEqual({
			kind: "list",
			id: "c2",
		});
	});

	it("compares centers along the list's axis", () => {
		const over = rect(100, 40);
		expect(toOverItem("b", over, rect(95, 40), "y")).toMatchObject({
			below: false,
		});
		expect(toOverItem("b", over, rect(110, 40), "y")).toMatchObject({
			below: true,
		});
		const row = rect(0, 40, 300, 200);
		expect(toOverItem("b", row, rect(0, 40, 450, 200), "x")).toMatchObject({
			below: true,
		});
		expect(toOverItem("b", row, null, "x")).toMatchObject({ below: false });
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

describe("coordinatesBefore", () => {
	it("centers the dragged item just before the target", () => {
		const target = rect(100, 40, 0, 200);
		const dragged = rect(0, 20, 0, 100);
		expect(coordinatesBefore(target, dragged, "y")).toEqual({ x: 50, y: 109 });
		expect(coordinatesBefore(target, dragged, "x")).toEqual({ x: 49, y: 110 });
	});
});
