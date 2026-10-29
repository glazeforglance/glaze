/*
 * Pure geometry for drag & drop. Nothing here touches the DOM: the hook
 * measures rectangles and passes them in, so every rule can be unit tested.
 *
 * The drop indicator is drawn on top of the lists (absolutely positioned),
 * so the layout never changes while dragging. That makes the measured
 * rectangles stable, which is what keeps the target from flickering.
 *
 * Rows (head widgets, split-columns) follow the UI direction: in RTL they run
 * right to left, so "before" and the beside sides are mirrored (see direction.ts).
 */
import {
	type InlineSide,
	mirrorSide,
	type TextDirection,
} from "./direction.ts";

/** A rectangle in viewport coordinates, like `getBoundingClientRect()`. */
export interface Rect {
	readonly top: number;
	readonly left: number;
	readonly width: number;
	readonly height: number;
}

/** A point in viewport coordinates. */
export interface Point {
	readonly x: number;
	readonly y: number;
}

/** How a list lays out its items: a vertical stack (columns) or a wrapping row (head widgets). */
export type ListLayout = "stack" | "row";

/** One list on screen, as measured at the moment of the pointer event. */
export interface ListGeometry {
	readonly id: string;
	readonly layout: ListLayout;
	/** The whole drop area of the list, including the space after its last item. */
	readonly rect: Rect;
	/** Its top-level items, in order. */
	readonly items: readonly Rect[];
}

/** Where the drop indicator is drawn, relative to its list's `rect`. */
export interface IndicatorLine {
	/**
	 * `horizontal` between stacked items, `vertical` between items in a row,
	 * `box` for an empty list, `beside` on the left or right edge of an item
	 * (the two will be put side by side).
	 */
	readonly kind: "horizontal" | "vertical" | "box" | "beside";
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/**
 * A "beside" position: the item under the pointer and which edge, in reading
 * order (`left` = before it, `right` = after it; mirrored on screen in RTL).
 */
export interface BesideHit {
	readonly index: number;
	readonly side: InlineSide;
}

/**
 * How far (px) the pointer must move past an item's midpoint before the slot
 * changes. Without it, a pointer resting on a midpoint toggles the target on
 * every pixel of hand tremor.
 */
export const HYSTERESIS_PX = 12;

/** Widest "beside" band on an item's left and right edge, in px. */
export const BESIDE_BAND_PX = 56;

/** The beside band is at most this share of the item's width. */
const BESIDE_SHARE = 0.22;

/** Gap between items in a list (Tailwind `gap-2`); the indicator sits in the middle of it. */
export const LIST_GAP_PX = 8;

const right = (rect: Rect) => rect.left + rect.width;
const bottom = (rect: Rect) => rect.top + rect.height;

/**
 * Tells whether a point lies inside a rectangle (edges included).
 * @param rect - The rectangle.
 * @param point - The point.
 * @returns True when the point is inside.
 */
export function containsPoint(rect: Rect, point: Point): boolean {
	return (
		point.x >= rect.left &&
		point.x <= right(rect) &&
		point.y >= rect.top &&
		point.y <= bottom(rect)
	);
}

/**
 * Finds the list under the pointer. When lists are nested (a split-column's
 * children inside a column), the innermost (smallest) one wins.
 * @param lists - Measured lists.
 * @param point - The pointer.
 * @returns The list, or `null` when the pointer is over none.
 */
export function listAtPoint(
	lists: readonly ListGeometry[],
	point: Point,
): ListGeometry | null {
	let best: ListGeometry | null = null;
	for (const list of lists) {
		if (!containsPoint(list.rect, point)) continue;
		if (
			!best ||
			list.rect.width * list.rect.height < best.rect.width * best.rect.height
		) {
			best = list;
		}
	}
	return best;
}

function grow(rect: Rect, by: number): Rect {
	return {
		top: rect.top - by,
		left: rect.left - by,
		width: rect.width + 2 * by,
		height: rect.height + 2 * by,
	};
}

function encloses(outer: Rect, inner: Rect): boolean {
	return (
		outer.left <= inner.left &&
		outer.top <= inner.top &&
		right(outer) >= right(inner) &&
		bottom(outer) >= bottom(inner)
	);
}

/**
 * Like `listAtPoint`, with hysteresis at the edges: the pointer stays in the
 * `previous` list until it is clearly outside it (more than `HYSTERESIS_PX`),
 * unless it is inside another list that isn't merely around the previous one.
 * Without this, a pointer resting on a list's edge toggles between "in the
 * list" and "nowhere".
 * @param lists - Measured lists.
 * @param point - The pointer.
 * @param previousId - The list of the current target, or `null`.
 * @returns The list, or `null` when the pointer is over none.
 */
export function stickyListAtPoint(
	lists: readonly ListGeometry[],
	point: Point,
	previousId: string | null,
): ListGeometry | null {
	const found = listAtPoint(lists, point);
	const previous = lists.find((list) => list.id === previousId);
	if (!previous || found?.id === previous.id) return found;
	if (!containsPoint(grow(previous.rect, HYSTERESIS_PX), point)) return found;
	// Leaving a nested list into the list around it still counts as the edge.
	return found === null || encloses(found.rect, previous.rect)
		? previous
		: found;
}

/** The dead band around one item's midpoint: never more than a quarter of the item. */
function marginFor(size: number): number {
	return Math.min(HYSTERESIS_PX, size / 4);
}

/**
 * Tells whether item `index` counts as "before" the pointer, so the slot is
 * after it. With a previous slot, the midpoints next to that slot are moved
 * away from the pointer by the hysteresis margin: items before the slot stay
 * before until the pointer is clearly above their middle, items after it
 * stay after until the pointer is clearly below theirs.
 */
function isBefore(
	item: Rect,
	index: number,
	layout: ListLayout,
	point: Point,
	previous: number | null,
	direction: TextDirection,
): boolean {
	const size = layout === "stack" ? item.height : item.width;
	const bias =
		previous === null
			? 0
			: index < previous
				? -marginFor(size)
				: marginFor(size);
	if (layout === "stack") {
		return point.y > item.top + item.height / 2 + bias;
	}
	// A row wraps like text: whole rows above the pointer are before it,
	// rows below are after it, and within the pointer's row the x position decides.
	if (bottom(item) <= point.y) return true;
	if (item.top > point.y) return false;
	const middle = item.left + item.width / 2;
	return direction === "rtl"
		? point.x < middle - bias
		: point.x > middle + bias;
}

/**
 * Picks the slot (0 = before the first item, `items.length` = after the last)
 * for a pointer inside a list, with hysteresis: when the pointer is near the
 * boundary of the `previous` slot, that slot is kept.
 * @param items - The list's item rectangles, in order.
 * @param layout - How the list lays out its items.
 * @param point - The pointer.
 * @param previous - The current slot in this list, or `null` when the pointer just entered it.
 * @param direction - The UI direction; rows run right to left in RTL.
 * @returns The slot index.
 */
export function slotAt(
	items: readonly Rect[],
	layout: ListLayout,
	point: Point,
	previous: number | null,
	direction: TextDirection = "ltr",
): number {
	let slot = 0;
	items.forEach((item, index) => {
		if (isBefore(item, index, layout, point, previous, direction)) {
			slot = index + 1;
		}
	});
	return slot;
}

/**
 * Finds a "beside" position: the pointer is over an item, close to its left
 * or right edge (a band of at most `BESIDE_BAND_PX`, and at most 22% of the
 * item's width). The band of the `previous` beside position is widened by the
 * hysteresis margin, so a pointer on the band's edge doesn't toggle.
 * @param items - The list's item rectangles.
 * @param point - The pointer.
 * @param previous - The current beside position in this list, or `null`.
 * @param direction - The UI direction: in RTL the left edge means "after".
 * @returns The item and edge (in reading order), or `null` when the pointer isn't in a band.
 */
export function besideAt(
	items: readonly Rect[],
	point: Point,
	previous: BesideHit | null,
	direction: TextDirection = "ltr",
): BesideHit | null {
	for (const [index, item] of items.entries()) {
		if (!containsPoint(item, point)) continue;
		const band = Math.min(BESIDE_BAND_PX, item.width * BESIDE_SHARE);
		// Bands are measured on screen; `previous` is in reading order.
		const grow = (edge: InlineSide) =>
			previous?.index === index && mirrorSide(previous.side, direction) === edge
				? Math.min(band + HYSTERESIS_PX, item.width / 2)
				: band;
		if (point.x <= item.left + grow("left")) {
			return { index, side: mirrorSide("left", direction) };
		}
		if (point.x >= right(item) - grow("right")) {
			return { index, side: mirrorSide("right", direction) };
		}
		return null;
	}
	return null;
}

/**
 * Where to draw the indicator, relative to the list's top-left corner: a
 * line in the gap between two items, a box over an empty list, or (with
 * `side`) a line on the left or right edge of item `slot`.
 * @param list - The measured list.
 * @param slot - The slot, 0..items.length; with `side`, the item's index.
 * @param side - For a "beside" target: which edge of the item, in reading order.
 * @param direction - The UI direction; rows and sides are mirrored in RTL.
 * @returns The indicator's position and size.
 */
export function indicatorLine(
	list: ListGeometry,
	slot: number,
	side?: BesideHit["side"],
	direction: TextDirection = "ltr",
): IndicatorLine {
	const { rect, items, layout } = list;
	const half = LIST_GAP_PX / 2;
	const item = items[slot];
	if (side && item) {
		return {
			kind: "beside",
			x:
				(mirrorSide(side, direction) === "left" ? item.left : right(item)) -
				rect.left,
			y: item.top - rect.top,
			width: 0,
			height: item.height,
		};
	}
	if (items.length === 0) {
		return { kind: "box", x: 0, y: 0, width: rect.width, height: rect.height };
	}
	const next = items[slot];
	const previous = items[slot - 1];
	if (layout === "stack") {
		const y = next
			? previous
				? (bottom(previous) + next.top) / 2
				: next.top - half
			: previous
				? bottom(previous) + half
				: rect.top;
		const anchor = next ?? previous ?? rect;
		return {
			kind: "horizontal",
			x: anchor.left - rect.left,
			y: Math.max(0, y - rect.top),
			width: anchor.width,
			height: 0,
		};
	}
	// In a row the line goes in the gap before the next item, or after the last
	// one: on the left and right in LTR, mirrored in RTL.
	const anchor = next ?? previous ?? rect;
	const rtl = direction === "rtl";
	const x = next
		? rtl
			? right(next) + half
			: next.left - half
		: rtl
			? anchor.left - half
			: right(anchor) + half;
	return {
		kind: "vertical",
		x: Math.max(0, x - rect.left),
		y: anchor.top - rect.top,
		width: 0,
		height: anchor.height,
	};
}

/**
 * Top-left coordinates that center the dragged preview on the indicator.
 * Keyboard drags use this only to move the preview; their drop position is
 * tracked logically.
 * @param list - The list the indicator is in.
 * @param line - The indicator, relative to `list.rect`.
 * @param dragged - Current rectangle of the dragged preview.
 * @returns Where the preview's top-left corner should go.
 */
export function previewPosition(
	list: ListGeometry,
	line: IndicatorLine,
	dragged: Rect,
): Point {
	const centerX = list.rect.left + line.x + line.width / 2;
	const centerY = list.rect.top + line.y + line.height / 2;
	return { x: centerX - dragged.width / 2, y: centerY - dragged.height / 2 };
}
