import {
	type ClientRect,
	type Collision,
	type CollisionDetection,
	closestCenter,
	pointerWithin,
	type UniqueIdentifier,
} from "@dnd-kit/core";
import type { OverItem } from "./drop-target.ts";

// Droppable ids: a widget uses its own id; a list registers its whole area
// (`list:<id>`) and a zone after its last widget (`end:<id>`).
const LIST_PREFIX = "list:";
const END_PREFIX = "end:";

/**
 * Droppable id of the drop indicator. Inserting the indicator pushes widgets
 * down, so the pointer often ends up over the indicator itself; that means
 * "keep the current drop position" (otherwise the indicator would flicker).
 */
export const INDICATOR_DROP_ID = "drop-indicator";

/** Droppable id for a list's whole area. */
export const listDropId = (listId: string): string => `${LIST_PREFIX}${listId}`;
/** Droppable id for the zone after a list's last widget. */
export const endDropId = (listId: string): string => `${END_PREFIX}${listId}`;

/** Lower is preferred: a widget beats an end zone, which beats empty list space. */
function rank(id: UniqueIdentifier): number {
	const text = String(id);
	if (text.startsWith(LIST_PREFIX)) return 2;
	if (text.startsWith(END_PREFIX)) return 1;
	return 0;
}

/**
 * Collision detection for the editor. With a pointer, only what is under it
 * counts (nothing when it is over e.g. the library) and the most specific
 * droppable wins (widget > end zone > list). Without a pointer (keyboard),
 * the closest widget or end zone wins; keyboard drags track their drop
 * position logically, so this mainly keeps dnd-kit's own state sensible.
 * @param args - What dnd-kit passes to a collision detection function.
 * @returns Collisions, best first.
 */
export const editorCollision: CollisionDetection = (args) => {
	const collisions: Collision[] =
		args.pointerCoordinates !== null
			? pointerWithin(args)
			: closestCenter({
					...args,
					droppableContainers: args.droppableContainers.filter(
						(container) => !String(container.id).startsWith(LIST_PREFIX),
					),
				});
	// Array.prototype.sort is stable, so equally ranked hits keep dnd-kit's order.
	return [...collisions].sort((a, b) => rank(a.id) - rank(b.id));
};

/**
 * Translates what dnd-kit reports as "over" into an `OverItem`.
 * For widgets, `before`/`after` comes from comparing centers along the list's axis.
 * @param overId - Id of the droppable under the dragged item.
 * @param overRect - Its rectangle.
 * @param activeRect - Current rectangle of the dragged item.
 * @param axis - `y` for stacked lists (columns), `x` for rows (head widgets).
 * @returns What the dragged item is over.
 */
export function toOverItem(
	overId: UniqueIdentifier,
	overRect: ClientRect,
	activeRect: ClientRect | null,
	axis: "x" | "y",
): OverItem {
	const id = String(overId);
	if (id.startsWith(LIST_PREFIX)) {
		return { kind: "list", id: id.slice(LIST_PREFIX.length) };
	}
	if (id.startsWith(END_PREFIX)) {
		return { kind: "list", id: id.slice(END_PREFIX.length) };
	}
	if (!activeRect) return { kind: "widget", id, below: false };
	const activeCenter =
		axis === "y"
			? activeRect.top + activeRect.height / 2
			: activeRect.left + activeRect.width / 2;
	const overCenter =
		axis === "y"
			? overRect.top + overRect.height / 2
			: overRect.left + overRect.width / 2;
	return { kind: "widget", id, below: activeCenter > overCenter };
}

/**
 * Top-left coordinates that put the dragged item's center just before a drop
 * target (1px above it, or left of it in a row). Keyboard drags use this only
 * to move the drag preview; the drop position itself is tracked logically.
 * @param targetRect - Rectangle of the widget or end zone to move to.
 * @param draggedRect - Current rectangle of the dragged item.
 * @param axis - Direction of the target's list.
 * @returns Where the dragged item's top-left corner should go.
 */
export function coordinatesBefore(
	targetRect: ClientRect,
	draggedRect: ClientRect,
	axis: "x" | "y",
): { x: number; y: number } {
	const x = targetRect.left + targetRect.width / 2 - draggedRect.width / 2;
	const y = targetRect.top + targetRect.height / 2 - draggedRect.height / 2;
	return axis === "y" ? { x, y: y - 1 } : { x: x - 1, y };
}
