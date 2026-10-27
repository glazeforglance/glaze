import { describe, expect, it } from "vitest";
import { clampSize, parsePanelState, sizeAfterKey } from "../src/lib/resize.ts";

const BOUNDS = { min: 200, max: 420 };
const DEFAULTS = { width: 260, collapsed: false };

describe("clampSize", () => {
	it("keeps a size within its bounds", () => {
		expect(clampSize(100, BOUNDS)).toBe(200);
		expect(clampSize(300, BOUNDS)).toBe(300);
		expect(clampSize(999, BOUNDS)).toBe(420);
	});
});

describe("sizeAfterKey", () => {
	it("moves by one step with the arrows, clamped", () => {
		expect(sizeAfterKey("ArrowRight", 260, BOUNDS, 16, 1)).toBe(276);
		expect(sizeAfterKey("ArrowLeft", 260, BOUNDS, 16, 1)).toBe(244);
		expect(sizeAfterKey("ArrowLeft", 210, BOUNDS, 16, 1)).toBe(200);
		expect(sizeAfterKey("ArrowRight", 410, BOUNDS, 16, 1)).toBe(420);
	});

	it("follows the handle for a panel on the right: moving it left makes the panel wider", () => {
		expect(sizeAfterKey("ArrowLeft", 330, BOUNDS, 16, -1)).toBe(346);
		expect(sizeAfterKey("ArrowRight", 330, BOUNDS, 16, -1)).toBe(314);
	});

	it("goes to the minimum and maximum with Home and End", () => {
		expect(sizeAfterKey("Home", 300, BOUNDS, 16, 1)).toBe(200);
		expect(sizeAfterKey("End", 300, BOUNDS, 16, -1)).toBe(420);
	});

	it("ignores other keys", () => {
		expect(sizeAfterKey("Enter", 300, BOUNDS, 16, 1)).toBeNull();
		expect(sizeAfterKey("ArrowUp", 300, BOUNDS, 16, 1)).toBeNull();
	});
});

describe("parsePanelState", () => {
	it("reads a stored state", () => {
		expect(
			parsePanelState('{"width":300,"collapsed":true}', DEFAULTS, BOUNDS),
		).toEqual({ width: 300, collapsed: true });
	});

	it("falls back to the defaults for nothing, broken JSON or wrong types", () => {
		expect(parsePanelState(null, DEFAULTS, BOUNDS)).toEqual(DEFAULTS);
		expect(parsePanelState("{nope", DEFAULTS, BOUNDS)).toEqual(DEFAULTS);
		expect(parsePanelState("42", DEFAULTS, BOUNDS)).toEqual(DEFAULTS);
		expect(
			parsePanelState('{"width":"wide","collapsed":1}', DEFAULTS, BOUNDS),
		).toEqual(DEFAULTS);
	});

	it("clamps a stored width that is out of bounds", () => {
		expect(parsePanelState('{"width":9000}', DEFAULTS, BOUNDS)).toEqual({
			width: 420,
			collapsed: false,
		});
	});
});
