import type { ListGeometry, Rect } from "./dnd-geometry.ts";

/*
 * Lists mark themselves in the DOM with data attributes, and the drag hook
 * measures them on every pointer move. Because the indicator never changes
 * the layout, these measurements are the same as what the user sees.
 */

/**
 * Data attributes for a list's drop area.
 * @param listId - The list's id.
 * @param layout - `stack` (column) or `row` (head widgets).
 * @returns Props to spread on the list's outer element.
 */
export function dropListProps(
	listId: string,
	layout: ListGeometry["layout"],
): Record<string, string> {
	return { "data-drop-list": listId, "data-drop-layout": layout };
}

/**
 * Data attribute for one top-level item of a list.
 * @param listId - The list the item belongs to (lists can be nested).
 * @returns Props to spread on the item's element.
 */
export function dropItemProps(listId: string): Record<string, string> {
	return { "data-drop-item-of": listId };
}

function toRect(element: Element): Rect {
	const { top, left, width, height } = element.getBoundingClientRect();
	return { top, left, width, height };
}

/**
 * Measures every list on screen with its items, in DOM order.
 * @param root - Where to look; the whole document by default.
 * @returns The measured lists.
 */
export function measureLists(root: ParentNode = document): ListGeometry[] {
	const lists = root.querySelectorAll<HTMLElement>("[data-drop-list]");
	return [...lists].map((element) => {
		const id = element.dataset.dropList ?? "";
		const items = element.querySelectorAll(
			`[data-drop-item-of="${CSS.escape(id)}"]`,
		);
		return {
			id,
			layout: element.dataset.dropLayout === "row" ? "row" : "stack",
			rect: toRect(element),
			items: [...items].map(toRect),
		};
	});
}
