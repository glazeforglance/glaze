import { describe, expect, it } from "vitest";
import type { ListGeometry } from "../src/lib/dnd-geometry.ts";
import {
	isArrowKey,
	isNoOp,
	locateWidget,
	nextKeyboardTarget,
	pointerTarget,
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
		expect(pointerTarget(LISTS, GEOMETRY, { x: 50, y: 55 }, null)).toEqual({
			listId: "c1",
			index: 1,
		});
		expect(pointerTarget(LISTS, GEOMETRY, { x: 50, y: 80 }, null)).toEqual({
			listId: "c1",
			index: 2,
		});
	});

	it("keeps the slot in the gap between two widgets instead of jumping to the end", () => {
		// y 42..46 is the gap between a and b: still "between a and b".
		expect(pointerTarget(LISTS, GEOMETRY, { x: 50, y: 44 }, null)).toEqual({
			listId: "c1",
			index: 1,
		});
	});

	it("drops at the end below the last widget, also in an empty list", () => {
		expect(pointerTarget(LISTS, GEOMETRY, { x: 50, y: 250 }, null)).toEqual({
			listId: "c1",
			index: 3,
		});
		expect(pointerTarget(LISTS, GEOMETRY, { x: 50, y: -30 }, null)).toEqual({
			listId: "head:p1",
			index: 0,
		});
	});

	it("is null outside every list or over an unknown list", () => {
		expect(pointerTarget(LISTS, GEOMETRY, { x: 210, y: 50 }, null)).toBeNull();
		const unknown: ListGeometry = {
			id: "zz",
			layout: "stack",
			rect: rect(0, 300),
			items: [],
		};
		expect(pointerTarget(LISTS, [unknown], { x: 50, y: 50 }, null)).toBeNull();
	});

	it("doesn't toggle when the pointer wobbles around a midpoint", () => {
		// b's middle is at y 68. Start just below it: slot 2.
		let target = pointerTarget(LISTS, GEOMETRY, { x: 50, y: 70 }, null);
		expect(target).toEqual({ listId: "c1", index: 2 });
		for (const y of [67, 64, 69, 62, 71, 66, 60]) {
			target = pointerTarget(LISTS, GEOMETRY, { x: 50, y }, target);
			expect(target).toEqual({ listId: "c1", index: 2 });
		}
		// Clearly above the middle (more than the hysteresis margin): slot 1.
		target = pointerTarget(LISTS, GEOMETRY, { x: 50, y: 57 }, target);
		expect(target).toEqual({ listId: "c1", index: 1 });
		for (const y of [70, 75, 77]) {
			target = pointerTarget(LISTS, GEOMETRY, { x: 50, y }, target);
			expect(target).toEqual({ listId: "c1", index: 1 });
		}
	});

	it("starts fresh, without hysteresis, in another list", () => {
		const previous = { listId: "c1", index: 3 };
		expect(pointerTarget(LISTS, GEOMETRY, { x: 300, y: 25 }, previous)).toEqual(
			{
				listId: "c2",
				index: 1,
			},
		);
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
