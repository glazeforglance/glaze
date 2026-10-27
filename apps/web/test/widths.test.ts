import { describe, expect, it } from "vitest";
import { columnEdgeChange } from "../src/lib/column-edge.ts";
import {
	fractionSymbol,
	snapColumns,
	stepColumns,
	widthLabel,
} from "../src/lib/widget-width.ts";

describe("snapColumns", () => {
	it("snaps to the nearest of ½, ⅓ and ¼", () => {
		expect(snapColumns(0.9)).toBe(2);
		expect(snapColumns(0.45)).toBe(2);
		expect(snapColumns(0.36)).toBe(3);
		expect(snapColumns(0.3)).toBe(3);
		expect(snapColumns(0.27)).toBe(4);
		expect(snapColumns(0.05)).toBe(4);
	});
});

describe("labels", () => {
	it("names the fraction and the columns", () => {
		expect(widthLabel(3)).toBe("⅓ · 3 columns");
		expect(fractionSymbol(2)).toBe("½");
		expect(fractionSymbol(5)).toBe("1/5");
	});
});

describe("stepColumns", () => {
	it("makes the widget narrower with Left and wider with Right, within ½…¼", () => {
		expect(stepColumns(2, "ArrowLeft")).toBe(3);
		expect(stepColumns(4, "ArrowLeft")).toBe(4);
		expect(stepColumns(3, "ArrowRight")).toBe(2);
		expect(stepColumns(2, "ArrowRight")).toBe(2);
		expect(stepColumns(6, "ArrowRight")).toBe(4);
		expect(stepColumns(3, "Home")).toBe(4);
		expect(stepColumns(3, "End")).toBe(2);
		expect(stepColumns(3, "Enter")).toBeNull();
	});
});

describe("columnEdgeChange", () => {
	it("makes the left column full when dragged right", () => {
		expect(columnEdgeChange(["small", "full", "small"], 0, 1)).toEqual({
			kind: "change",
			index: 0,
			size: "full",
		});
	});

	it("makes the right column small instead when a third full column isn't allowed", () => {
		expect(columnEdgeChange(["small", "full", "full"], 0, 1)).toEqual({
			kind: "change",
			index: 1,
			size: "small",
		});
	});

	it("makes the left column small when dragged left", () => {
		expect(columnEdgeChange(["full", "full", "small"], 0, -1)).toEqual({
			kind: "change",
			index: 0,
			size: "small",
		});
	});

	it("falls back to the other column when the first change breaks a rule", () => {
		// Column 1 is the only full one, so it can't become small: column 2 grows instead.
		expect(columnEdgeChange(["full", "small", "small"], 0, -1)).toEqual({
			kind: "change",
			index: 1,
			size: "full",
		});
	});

	it("explains why nothing changes when both columns already have that size", () => {
		expect(columnEdgeChange(["full", "small"], 0, 1)).toEqual({
			kind: "blocked",
			reason: "Column 1 is already full and column 2 already small.",
		});
		expect(columnEdgeChange(["small", "full"], 0, -1)).toEqual({
			kind: "blocked",
			reason: "Column 1 is already small and column 2 already full.",
		});
	});
});
