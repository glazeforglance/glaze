import { describe, expect, it } from "vitest";
import {
	inlineDelta,
	inlineStartX,
	logicalKey,
	mirrorSide,
} from "../src/lib/direction.ts";
import {
	besideAt,
	indicatorLine,
	type ListGeometry,
	type Rect,
	slotAt,
} from "../src/lib/dnd-geometry.ts";
import { nextKeyboardTarget, type WidgetList } from "../src/lib/drop-target.ts";
import { sizeAfterKey } from "../src/lib/resize.ts";

const rect = (left: number, top = 0, width = 100, height = 40): Rect => ({
	top,
	left,
	width,
	height,
});

// A row of three head widgets. In LTR they read a, b, c from left to right;
// in RTL item 0 is on the right: a at 216..316, b at 108..208, c at 0..100.
const LTR_ROW = [rect(0), rect(108), rect(216)];
const RTL_ROW = [rect(216), rect(108), rect(0)];

describe("direction helpers", () => {
	it("turns screen distances into reading-order distances", () => {
		expect(inlineDelta(30, "ltr")).toBe(30);
		expect(inlineDelta(30, "rtl")).toBe(-30);
	});

	it("swaps only the horizontal arrows in RTL", () => {
		expect(logicalKey("ArrowLeft", "rtl")).toBe("ArrowRight");
		expect(logicalKey("ArrowRight", "rtl")).toBe("ArrowLeft");
		expect(logicalKey("ArrowUp", "rtl")).toBe("ArrowUp");
		expect(logicalKey("ArrowLeft", "ltr")).toBe("ArrowLeft");
	});

	it("mirrors sides both ways", () => {
		expect(mirrorSide("left", "rtl")).toBe("right");
		expect(mirrorSide(mirrorSide("left", "rtl"), "rtl")).toBe("left");
		expect(mirrorSide("left", "ltr")).toBe("left");
	});

	it("finds the inline start edge", () => {
		expect(inlineStartX({ left: 10, width: 50 }, "ltr")).toBe(10);
		expect(inlineStartX({ left: 10, width: 50 }, "rtl")).toBe(60);
	});
});

describe("row slots in RTL", () => {
	it("counts items to the right of the pointer as before it", () => {
		// Between a (right) and b (middle): slot 1, like between a and b in LTR.
		expect(slotAt(RTL_ROW, "row", { x: 212, y: 20 }, null, "rtl")).toBe(1);
		expect(slotAt(LTR_ROW, "row", { x: 104, y: 20 }, null, "ltr")).toBe(1);
	});

	it("puts the pointer left of everything at the end", () => {
		expect(slotAt(RTL_ROW, "row", { x: 5, y: 20 }, null, "rtl")).toBe(3);
		expect(slotAt(RTL_ROW, "row", { x: 310, y: 20 }, null, "rtl")).toBe(0);
	});

	it("leaves stacked columns alone", () => {
		const stack = [rect(0, 0), rect(0, 48)];
		expect(slotAt(stack, "stack", { x: 50, y: 60 }, null, "rtl")).toBe(1);
	});
});

describe("beside drops in RTL", () => {
	const items = [rect(0, 0, 200)];

	it("treats the right edge as before the widget", () => {
		expect(besideAt(items, { x: 195, y: 20 }, null, "rtl")).toEqual({
			index: 0,
			side: "left",
		});
		expect(besideAt(items, { x: 5, y: 20 }, null, "rtl")).toEqual({
			index: 0,
			side: "right",
		});
	});

	it("keeps LTR as it was", () => {
		expect(besideAt(items, { x: 5, y: 20 }, null, "ltr")).toEqual({
			index: 0,
			side: "left",
		});
	});

	it("keeps the hysteresis on the same screen edge", () => {
		// 50px from the right edge: outside the 44px band, inside band + 12px.
		const point = { x: 150, y: 20 };
		expect(besideAt(items, point, null, "rtl")).toBeNull();
		expect(besideAt(items, point, { index: 0, side: "left" }, "rtl")).toEqual({
			index: 0,
			side: "left",
		});
	});
});

describe("indicator in RTL", () => {
	const list: ListGeometry = {
		id: "head",
		layout: "row",
		rect: rect(0, 0, 316),
		items: RTL_ROW,
	};

	it("draws the line right of the next item", () => {
		// Slot 1 is before b, whose right edge is at 208: the gap is 208..216.
		expect(indicatorLine(list, 1, undefined, "rtl").x).toBe(212);
	});

	it("draws the end slot left of the last item", () => {
		expect(indicatorLine(list, 3, undefined, "rtl").x).toBe(0);
	});

	it("puts a 'before' beside line on the right edge", () => {
		const column: ListGeometry = {
			id: "c1",
			layout: "stack",
			rect: rect(0, 0, 200),
			items: [rect(0, 0, 200)],
		};
		expect(indicatorLine(column, 0, "left", "rtl").x).toBe(200);
		expect(indicatorLine(column, 0, "left", "ltr").x).toBe(0);
	});
});

describe("keyboard drags in RTL", () => {
	const lists: WidgetList[] = [
		{
			id: "head",
			kind: "head",
			path: ["pages", 0, "head-widgets"],
			widgetIds: ["h1", "h2"],
			label: "head widgets",
			ownerIds: [],
		},
		{
			id: "c1",
			kind: "column",
			path: ["pages", 0, "columns", 0, "widgets"],
			widgetIds: ["a"],
			label: "column 1",
			ownerIds: [],
		},
		{
			id: "c2",
			kind: "column",
			path: ["pages", 0, "columns", 1, "widgets"],
			widgetIds: ["b"],
			label: "column 2",
			ownerIds: [],
		},
	];

	it("goes to the next column with ArrowLeft", () => {
		const current = { listId: "c1", index: 0 };
		expect(
			nextKeyboardTarget(lists, current, null, "ArrowLeft", "rtl"),
		).toEqual({ listId: "c2", index: 0 });
		expect(
			nextKeyboardTarget(lists, current, null, "ArrowRight", "rtl"),
		).toBeNull();
	});

	it("moves along the head widgets with ArrowLeft", () => {
		const current = { listId: "head", index: 0 };
		expect(
			nextKeyboardTarget(lists, current, null, "ArrowLeft", "rtl"),
		).toEqual({ listId: "head", index: 1 });
	});

	it("keeps LTR arrows as they were", () => {
		const current = { listId: "c1", index: 0 };
		expect(
			nextKeyboardTarget(lists, current, null, "ArrowRight", "ltr"),
		).toEqual({ listId: "c2", index: 0 });
	});
});

describe("resize keys in RTL", () => {
	it("grows a start panel with ArrowLeft once the key is made logical", () => {
		const bounds = { min: 100, max: 400 };
		const key = logicalKey("ArrowLeft", "rtl");
		expect(sizeAfterKey(key, 200, bounds, 16, 1)).toBe(216);
	});
});
