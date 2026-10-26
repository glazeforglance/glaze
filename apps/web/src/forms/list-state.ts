/*
 * List items have no ids, only positions. These helpers keep per-item UI
 * state (which items are folded open, where focus goes) attached to the right
 * item when items move or disappear.
 */

/**
 * Moves the item at `from` to `to` in a set of item indexes.
 * @param indexes - E.g. the items that are folded open.
 * @param from - Old index of the moved item.
 * @param to - New index, counted without the moved item (as in `moveWidgetListItem`).
 * @returns The indexes after the move.
 */
export function moveIndexes(
	indexes: ReadonlySet<number>,
	from: number,
	to: number,
): Set<number> {
	const next = new Set<number>();
	for (const index of indexes) {
		if (index === from) next.add(to);
		else {
			// Take the item out, then put it back at `to`.
			const without = index > from ? index - 1 : index;
			next.add(without >= to ? without + 1 : without);
		}
	}
	return next;
}

/**
 * Drops a removed item from a set of item indexes and shifts the later ones.
 * @param indexes - E.g. the items that are folded open.
 * @param removed - Index of the removed item.
 * @returns The indexes after the removal.
 */
export function removeIndex(
	indexes: ReadonlySet<number>,
	removed: number,
): Set<number> {
	const next = new Set<number>();
	for (const index of indexes) {
		if (index < removed) next.add(index);
		else if (index > removed) next.add(index - 1);
	}
	return next;
}

/**
 * Picks the item that gets focus after one was removed: the item that took
 * its place, else the one before it.
 * @param removed - Index of the removed item.
 * @param remaining - Number of items left.
 * @returns The index to focus, or `null` when the list is now empty.
 */
export function focusAfterRemove(
	removed: number,
	remaining: number,
): number | null {
	if (remaining === 0) return null;
	return Math.min(removed, remaining - 1);
}
