/*
 * Everything in the editor that has a direction goes through these helpers,
 * so a right-to-left language works without `if (rtl)` checks spread around.
 * The rest of the code thinks in "start" and "end" (LTR: left and right);
 * these convert between that and what the screen and the keyboard report.
 */
import type { TextDirection } from "./languages.ts";

export type { TextDirection } from "./languages.ts";

/**
 * Turns a horizontal distance on screen into one along the line of text.
 * @param deltaX - `clientX` difference; positive is to the right.
 * @param direction - The UI direction.
 * @returns The distance; positive is towards the inline end.
 */
export function inlineDelta(deltaX: number, direction: TextDirection): number {
	return direction === "rtl" ? -deltaX : deltaX;
}

/**
 * Turns an arrow key into its logical meaning: in RTL, ArrowLeft moves
 * towards the end of a row, so it acts like ArrowRight does in LTR.
 * @param key - `KeyboardEvent.key` or `.code`.
 * @param direction - The UI direction.
 * @returns The key as LTR code should handle it; other keys are unchanged.
 */
export function logicalKey<Key extends string>(
	key: Key,
	direction: TextDirection,
): Key | "ArrowLeft" | "ArrowRight" {
	if (direction === "ltr") return key;
	if (key === "ArrowLeft") return "ArrowRight";
	if (key === "ArrowRight") return "ArrowLeft";
	return key;
}

/** A side in reading order: `left` is the start of the line, `right` its end (as in LTR). */
export type InlineSide = "left" | "right";

/**
 * Converts between a physical side (the edge the pointer is on) and a side in
 * reading order. The mapping is its own inverse, so it works both ways.
 * @param side - A side.
 * @param direction - The UI direction.
 * @returns The same side in LTR, the opposite one in RTL.
 */
export function mirrorSide(
	side: InlineSide,
	direction: TextDirection,
): InlineSide {
	if (direction === "ltr") return side;
	return side === "left" ? "right" : "left";
}

/**
 * The x position of an element's inline start edge.
 * @param rect - The element's rectangle.
 * @param direction - The UI direction.
 * @returns `left` in LTR, `left + width` in RTL.
 */
export function inlineStartX(
	rect: { readonly left: number; readonly width: number },
	direction: TextDirection,
): number {
	return direction === "rtl" ? rect.left + rect.width : rect.left;
}
