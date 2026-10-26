import { describe, expect, it } from "vitest";
import {
	focusAfterRemove,
	moveIndexes,
	removeIndex,
} from "../../src/forms/list-state.ts";

describe("moveIndexes", () => {
	it("keeps open items attached to the item that moved", () => {
		// [A, B, C] with A and C open; A moves to the end → [B, C, A].
		expect([...moveIndexes(new Set([0, 2]), 0, 2)].sort()).toEqual([1, 2]);
		// C moves to the top → [C, A, B]; A was open.
		expect([...moveIndexes(new Set([0]), 2, 0)]).toEqual([1]);
		// One step down: [A, B, C] → [B, A, C]; B was open.
		expect([...moveIndexes(new Set([1]), 0, 1)]).toEqual([0]);
	});
});

describe("removeIndex", () => {
	it("drops the removed item and shifts the later ones", () => {
		expect([...removeIndex(new Set([0, 1, 3]), 1)].sort()).toEqual([0, 2]);
	});
});

describe("focusAfterRemove", () => {
	it("focuses the item that took the removed one's place, else the one before", () => {
		expect(focusAfterRemove(1, 3)).toBe(1);
		expect(focusAfterRemove(3, 3)).toBe(2);
		expect(focusAfterRemove(0, 0)).toBeNull();
	});
});
