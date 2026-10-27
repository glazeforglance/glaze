import { describe, expect, it } from "vitest";
import {
	containsPoint,
	indicatorLine,
	type ListGeometry,
	listAtPoint,
	previewPosition,
	type Rect,
	slotAt,
	stickyListAtPoint,
} from "../src/lib/dnd-geometry.ts";

const rect = (top: number, height = 40, left = 0, width = 200): Rect => ({
	top,
	left,
	width,
	height,
});

// Three stacked widgets, 40px tall with 8px gaps: middles at 20, 68 and 116.
const STACK = [rect(0), rect(48), rect(96)];

describe("containsPoint and listAtPoint", () => {
	it("includes the edges", () => {
		expect(containsPoint(rect(0), { x: 0, y: 0 })).toBe(true);
		expect(containsPoint(rect(0), { x: 200, y: 40 })).toBe(true);
		expect(containsPoint(rect(0), { x: 201, y: 40 })).toBe(false);
	});

	it("picks the innermost list when lists are nested", () => {
		const outer: ListGeometry = {
			id: "outer",
			layout: "stack",
			rect: rect(0, 400, 0, 400),
			items: [],
		};
		const inner: ListGeometry = {
			id: "inner",
			layout: "row",
			rect: rect(100, 50, 10, 300),
			items: [],
		};
		expect(listAtPoint([outer, inner], { x: 50, y: 120 })?.id).toBe("inner");
		expect(listAtPoint([inner, outer], { x: 50, y: 120 })?.id).toBe("inner");
		expect(listAtPoint([outer, inner], { x: 50, y: 300 })?.id).toBe("outer");
		expect(listAtPoint([outer], { x: 500, y: 0 })).toBeNull();
	});
});

describe("stickyListAtPoint", () => {
	const column: ListGeometry = {
		id: "c1",
		layout: "stack",
		rect: rect(100, 300, 0, 200),
		items: [],
	};
	const neighbour: ListGeometry = {
		id: "c2",
		layout: "stack",
		rect: rect(100, 300, 216, 200),
		items: [],
	};
	const nested: ListGeometry = {
		id: "split",
		layout: "row",
		rect: rect(150, 60, 10, 180),
		items: [],
	};

	it("keeps the previous list while the pointer wobbles on its edge", () => {
		for (const y of [101, 98, 95, 99, 90]) {
			expect(stickyListAtPoint([column], { x: 50, y }, "c1")?.id).toBe("c1");
		}
		// Clearly outside (more than the margin above the top edge).
		expect(stickyListAtPoint([column], { x: 50, y: 85 }, "c1")).toBeNull();
		// Without a previous list, the edge is exact.
		expect(stickyListAtPoint([column], { x: 50, y: 98 }, null)).toBeNull();
	});

	it("switches at once when the pointer is inside a neighbouring list", () => {
		expect(
			stickyListAtPoint([column, neighbour], { x: 210, y: 200 }, "c1")?.id,
		).toBe("c1");
		expect(
			stickyListAtPoint([column, neighbour], { x: 217, y: 200 }, "c1")?.id,
		).toBe("c2");
	});

	it("treats leaving a nested list into its parent as the edge", () => {
		expect(
			stickyListAtPoint([column, nested], { x: 50, y: 214 }, "split")?.id,
		).toBe("split");
		expect(
			stickyListAtPoint([column, nested], { x: 50, y: 240 }, "split")?.id,
		).toBe("c1");
	});
});

describe("slotAt in a stack", () => {
	it("counts the widgets whose middle is above the pointer", () => {
		expect(slotAt(STACK, "stack", { x: 0, y: 5 }, null)).toBe(0);
		expect(slotAt(STACK, "stack", { x: 0, y: 25 }, null)).toBe(1);
		expect(slotAt(STACK, "stack", { x: 0, y: 44 }, null)).toBe(1);
		expect(slotAt(STACK, "stack", { x: 0, y: 117 }, null)).toBe(3);
		expect(slotAt([], "stack", { x: 0, y: 117 }, null)).toBe(0);
	});

	it("keeps the previous slot within the hysteresis band", () => {
		// Coming from slot 1, the next boundary is b's middle (68) + 10.
		expect(slotAt(STACK, "stack", { x: 0, y: 75 }, 1)).toBe(1);
		expect(slotAt(STACK, "stack", { x: 0, y: 79 }, 1)).toBe(2);
		// Coming from slot 2, going back needs b's middle - 10.
		expect(slotAt(STACK, "stack", { x: 0, y: 59 }, 2)).toBe(2);
		expect(slotAt(STACK, "stack", { x: 0, y: 57 }, 2)).toBe(1);
	});

	it("never toggles for small movements around a boundary", () => {
		let slot = slotAt(STACK, "stack", { x: 0, y: 69 }, null);
		const seen = new Set<number>();
		for (let step = 0; step < 200; step += 1) {
			// ±6 px of jitter around the boundary at y 68.
			const y = 68 + Math.sin(step) * 6;
			slot = slotAt(STACK, "stack", { x: 0, y }, slot);
			seen.add(slot);
		}
		expect([...seen]).toEqual([2]);
	});

	it("scales the band down for small widgets so they can still be passed", () => {
		const tiny = [rect(0, 16), rect(24, 16)];
		// Margin is a quarter of 16 = 4, so 4px past the middle (8) switches.
		expect(slotAt(tiny, "stack", { x: 0, y: 11 }, 0)).toBe(0);
		expect(slotAt(tiny, "stack", { x: 0, y: 13 }, 0)).toBe(1);
	});
});

describe("slotAt in a wrapping row", () => {
	// Two rows of two: [a b] at y 0..40, [c d] at y 48..88; each 200 wide, 8 apart.
	const ROW = [
		rect(0, 40, 0),
		rect(0, 40, 208),
		rect(48, 40, 0),
		rect(48, 40, 208),
	];

	it("reads like text: earlier rows first, then x within the row", () => {
		expect(slotAt(ROW, "row", { x: 50, y: 20 }, null)).toBe(0);
		expect(slotAt(ROW, "row", { x: 150, y: 20 }, null)).toBe(1);
		expect(slotAt(ROW, "row", { x: 350, y: 20 }, null)).toBe(2);
		expect(slotAt(ROW, "row", { x: 50, y: 60 }, null)).toBe(2);
		expect(slotAt(ROW, "row", { x: 350, y: 60 }, null)).toBe(4);
	});

	it("applies hysteresis along x", () => {
		// b's middle is at x 308; margin 12.
		expect(slotAt(ROW, "row", { x: 315, y: 20 }, 1)).toBe(1);
		expect(slotAt(ROW, "row", { x: 321, y: 20 }, 1)).toBe(2);
		expect(slotAt(ROW, "row", { x: 300, y: 20 }, 2)).toBe(2);
	});
});

describe("indicatorLine", () => {
	const list: ListGeometry = {
		id: "c1",
		layout: "stack",
		rect: rect(100, 300, 20, 220),
		items: [rect(100, 40, 30), rect(148, 40, 30), rect(196, 40, 30)],
	};

	it("draws a horizontal line in the middle of the gap, relative to the list", () => {
		expect(indicatorLine(list, 1)).toEqual({
			kind: "horizontal",
			x: 10,
			y: 44,
			width: 200,
			height: 0,
		});
	});

	it("puts the first and last lines half a gap outside the items", () => {
		// Above the first item: clamped to the list's top edge.
		expect(indicatorLine(list, 0)).toMatchObject({ y: 0 });
		expect(indicatorLine(list, 3)).toMatchObject({ y: 140 });
	});

	it("covers an empty list with a box", () => {
		expect(indicatorLine({ ...list, items: [] }, 0)).toEqual({
			kind: "box",
			x: 0,
			y: 0,
			width: 220,
			height: 300,
		});
	});

	it("draws a vertical line in a row", () => {
		const row: ListGeometry = {
			id: "head",
			layout: "row",
			rect: rect(0, 50, 0, 600),
			items: [rect(5, 40, 0), rect(5, 40, 208)],
		};
		expect(indicatorLine(row, 1)).toEqual({
			kind: "vertical",
			x: 204,
			y: 5,
			width: 0,
			height: 40,
		});
		expect(indicatorLine(row, 2)).toMatchObject({ x: 412 });
	});

	it("centers a keyboard drag's preview on the line", () => {
		const line = indicatorLine(list, 1);
		expect(previewPosition(list, line, rect(0, 20, 0, 100))).toEqual({
			x: 80,
			y: 134,
		});
	});
});
