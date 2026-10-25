import type { PageNode, YamlPath } from "@glaze/core";

/** A list of widgets that accepts drops: a column, or the page's head widgets. */
export interface WidgetList {
	/** The column's id, or `head:<pageId>` for head widgets. */
	readonly id: string;
	/** Path of the list in the YAML, as the core edit functions want it. */
	readonly path: YamlPath;
	/** Top-level widget ids, in display order. */
	readonly widgetIds: readonly string[];
	/** Human name, used in screen reader announcements. */
	readonly label: string;
}

const HEAD_PREFIX = "head:";

/**
 * Tells whether a list is the page's head widgets (laid out as a row) rather than a column.
 * @param list - A list from `listsOfPage`.
 * @returns True for head widgets.
 */
export function isHeadList(list: WidgetList): boolean {
	return list.id.startsWith(HEAD_PREFIX);
}

/** Where a dragged widget would land: a position in a list as it is shown (dragged widget included). */
export interface DropTarget {
	readonly listId: string;
	readonly index: number;
}

/** What the pointer or keyboard is over. */
export type OverItem =
	| { readonly kind: "widget"; readonly id: string; readonly below: boolean }
	| { readonly kind: "list"; readonly id: string };

/**
 * Lists the drop targets of a page: head widgets first, then the columns.
 * Head widgets are always included so widgets can be dropped there even when the page has none yet.
 * @param page - The open page.
 * @returns The page's widget lists.
 */
export function listsOfPage(page: PageNode): WidgetList[] {
	return [
		{
			id: `${HEAD_PREFIX}${page.id}`,
			path: [...page.path, "head-widgets"],
			widgetIds: page.headWidgets.map((widget) => widget.id),
			label: "head widgets",
		},
		...page.columns.map((column, index) => ({
			id: column.id,
			path: [...column.path, "widgets"],
			widgetIds: column.widgets.map((widget) => widget.id),
			label: `column ${index + 1}`,
		})),
	];
}

/**
 * Finds the list and position of a top-level widget.
 * @param lists - The page's lists.
 * @param widgetId - The widget to look for.
 * @returns Its list and index, or `null` when it isn't a top-level widget of this page.
 */
export function locateWidget(
	lists: readonly WidgetList[],
	widgetId: string,
): DropTarget | null {
	for (const list of lists) {
		const index = list.widgetIds.indexOf(widgetId);
		if (index !== -1) return { listId: list.id, index };
	}
	return null;
}

/**
 * Turns "what is under the dragged item" into a drop position.
 * Over a widget: before it, or after it when the dragged item is over its lower half.
 * Over a list (empty space or its end zone): at the end of that list.
 * @param lists - The page's lists.
 * @param over - What the dragged item is over.
 * @returns The drop position, or `null` when `over` isn't a known widget or list.
 */
export function targetFromOver(
	lists: readonly WidgetList[],
	over: OverItem,
): DropTarget | null {
	if (over.kind === "list") {
		const list = lists.find((candidate) => candidate.id === over.id);
		return list ? { listId: list.id, index: list.widgetIds.length } : null;
	}
	const found = locateWidget(lists, over.id);
	if (!found) return null;
	return { listId: found.listId, index: found.index + (over.below ? 1 : 0) };
}

/**
 * True when dropping at `target` would leave a widget where it already is
 * (right before or right after itself in its own list).
 * @param source - Where the dragged widget is now, or `null` for a library item.
 * @param target - Where it would be dropped.
 * @returns Whether the drop changes nothing.
 */
export function isNoOp(source: DropTarget | null, target: DropTarget): boolean {
	return (
		source !== null &&
		source.listId === target.listId &&
		(target.index === source.index || target.index === source.index + 1)
	);
}

/**
 * Converts a drop position as shown on screen into the index `moveWidget`
 * (and `addWidget`) in `@glaze/core` expect: core counts positions after the
 * widget was taken out, so moving down within the same list shifts by one.
 * @param source - Where the dragged widget is now, or `null` for a library item.
 * @param target - Where it is dropped.
 * @returns The index to pass to core.
 */
export function toCoreIndex(
	source: DropTarget | null,
	target: DropTarget,
): number {
	return source !== null &&
		source.listId === target.listId &&
		source.index < target.index
		? target.index - 1
		: target.index;
}

/** Arrow keys used to move a widget while dragging with the keyboard. */
export type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

/**
 * Tells whether a `KeyboardEvent.code` is an arrow key.
 * @param code - The key code.
 * @returns True for the four arrow keys.
 */
export function isArrowKey(code: string): code is ArrowKey {
	return (
		code === "ArrowUp" ||
		code === "ArrowDown" ||
		code === "ArrowLeft" ||
		code === "ArrowRight"
	);
}

/**
 * Moves a keyboard drag one step. Navigation is logical, not geometric, so the
 * drop indicator pushing widgets around can't make it skip or get stuck:
 * - Up/Down move one position within a column (Left/Right within head widgets);
 * - Left/Right jump to the neighbouring column, at about the same position;
 * - Up from the top of a column goes to the end of the head widgets,
 *   Down from the head widgets goes to the top of the first column;
 * - a step that would only move between the two "no change" positions around
 *   the dragged widget itself skips one further.
 * @param lists - The page's lists, head widgets first.
 * @param current - Current drop position, or `null` when nothing is targeted yet.
 * @param source - Where the dragged widget is, or `null` for a library item.
 * @param key - The arrow key that was pressed.
 * @returns The new drop position, or `null` to stay where it is.
 */
export function nextKeyboardTarget(
	lists: readonly WidgetList[],
	current: DropTarget | null,
	source: DropTarget | null,
	key: ArrowKey,
): DropTarget | null {
	const columns = lists.filter((list) => !isHeadList(list));
	const head = lists.find(isHeadList);
	if (!current) {
		const first = columns[0] ?? head;
		return first ? { listId: first.id, index: 0 } : null;
	}
	const list = lists.find((candidate) => candidate.id === current.listId);
	if (!list) return null;

	const inHead = isHeadList(list);
	const alongList = inHead
		? key === "ArrowLeft" || key === "ArrowRight"
		: key === "ArrowUp" || key === "ArrowDown";

	if (alongList) {
		const delta = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;
		let index = current.index + delta;
		if (isNoOp(source, current) && isNoOp(source, { listId: list.id, index })) {
			index += delta;
		}
		if (index >= 0 && index <= list.widgetIds.length) {
			return { listId: list.id, index };
		}
		// Past the top of a column: continue in the head widgets above.
		if (index < 0 && !inHead && head) {
			return { listId: head.id, index: head.widgetIds.length };
		}
		return null;
	}

	if (inHead) {
		// Down leaves the head widgets for the first column; Up has nowhere to go.
		const first = columns[0];
		return key === "ArrowDown" && first ? { listId: first.id, index: 0 } : null;
	}

	const position = columns.findIndex((column) => column.id === list.id);
	const neighbour = columns[position + (key === "ArrowRight" ? 1 : -1)];
	if (!neighbour) return null;
	return {
		listId: neighbour.id,
		index: Math.min(current.index, neighbour.widgetIds.length),
	};
}
