/*
 * Pure geometry for drag & drop. Nothing here touches the DOM: the hook
 * measures rectangles and passes them in, so every rule can be unit tested.
 *
 * The drop indicator is drawn on top of the lists (absolutely positioned),
 * so the layout never changes while dragging. That makes the measured
 * rectangles stable, which is what keeps the target from flickering.
 */

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
	/** `horizontal` between stacked items, `vertical` between items in a row, `box` for an empty list. */
	readonly kind: "horizontal" | "vertical" | "box";
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/**
 * How far (px) the pointer must move past an item's midpoint before the slot
 * changes. Without it, a pointer resting on a midpoint toggles the target on
 * every pixel of hand tremor.
 */
export const HYSTERESIS_PX = 12;

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
	return point.x > item.left + item.width / 2 + bias;
}

/**
 * Picks the slot (0 = before the first item, `items.length` = after the last)
 * for a pointer inside a list, with hysteresis: when the pointer is near the
 * boundary of the `previous` slot, that slot is kept.
 * @param items - The list's item rectangles, in order.
 * @param layout - How the list lays out its items.
 * @param point - The pointer.
 * @param previous - The current slot in this list, or `null` when the pointer just entered it.
 * @returns The slot index.
 */
export function slotAt(
	items: readonly Rect[],
	layout: ListLayout,
	point: Point,
	previous: number | null,
): number {
	let slot = 0;
	items.forEach((item, index) => {
		if (isBefore(item, index, layout, point, previous)) slot = index + 1;
	});
	return slot;
}

/**
 * Where to draw the indicator for a slot, relative to the list's top-left
 * corner: a line in the gap between two items, or a box over an empty list.
 * @param list - The measured list.
 * @param slot - The slot, 0..items.length.
 * @returns The indicator's position and size.
 */
export function indicatorLine(list: ListGeometry, slot: number): IndicatorLine {
	const { rect, items, layout } = list;
	const half = LIST_GAP_PX / 2;
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
	// In a row the line goes in the gap left of the next item, or right of the last one.
	const anchor = next ?? previous ?? rect;
	const x = next ? next.left - half : right(anchor) + half;
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
