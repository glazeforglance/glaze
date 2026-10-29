import type { PageNode, WidgetNode, YamlPath } from "@glaze/core";
import { i18n } from "../i18n.ts";
import {
	besideAt,
	type ListGeometry,
	type Point,
	slotAt,
	stickyListAtPoint,
} from "./dnd-geometry.ts";
import {
	type InlineSide,
	logicalKey,
	type TextDirection,
} from "./direction.ts";

/**
 * What kind of list a drop target is: the page's head widgets, a column, or
 * the children of a `split-column` or `group` (nested inside a column).
 */
export type ListKind = "head" | "column" | "split" | "group";

/** A list of widgets that accepts drops. */
export interface WidgetList {
	/** `head:<pageId>`, the column's id, or `split:<widgetId>` / `group:<widgetId>`. */
	readonly id: string;
	readonly kind: ListKind;
	/** Path of the list in the YAML, as the core edit functions want it. */
	readonly path: YamlPath;
	/** Widget ids in the list, in display order. */
	readonly widgetIds: readonly string[];
	/** Human name in the UI language, used in labels and screen reader announcements. */
	readonly label: string;
	/** The container widgets this list is inside, outermost first (empty for head and columns). */
	readonly ownerIds: readonly string[];
}

/**
 * Tells whether a list is the page's head widgets (laid out as a row) rather than a column.
 * @param list - A list from `listsOfPage`.
 * @returns True for head widgets.
 */
export function isHeadList(list: WidgetList): boolean {
	return list.kind === "head";
}

/** Which side of a widget a "beside" drop goes, in reading order (`left` = before). */
export type DropSide = InlineSide;

/**
 * Where a dragged widget would land. Without `side`: a slot in a list as it
 * is shown (dragged widget included). With `side`: beside the widget at
 * `index`, so both end up side by side in a split-column.
 */
export interface DropTarget {
	readonly listId: string;
	readonly index: number;
	readonly side?: DropSide;
}

/** What is being dragged, as far as the drop rules are concerned. */
export interface DragSubject {
	readonly type: string | null;
	/** The dragged widget, or `null` for a new widget from the library. */
	readonly widgetId: string | null;
}

/**
 * The drop list of a `split-column` or `group`'s children, or `null` for
 * other widgets. Components and `listsOfPage` both use this, so the ids match.
 * @param widget - Any widget.
 * @param ownerIds - Container widgets around `widget`, outermost first.
 * @param where - Where the widget is, for announcements, e.g. "column 2" (translated).
 * @returns The list, or `null`.
 */
export function containerList(
	widget: WidgetNode,
	ownerIds: readonly string[],
	where: string,
): WidgetList | null {
	if (widget.type !== "split-column" && widget.type !== "group") return null;
	const isSplit = widget.type === "split-column";
	return {
		id: `${isSplit ? "split" : "group"}:${widget.id}`,
		kind: isSplit ? "split" : "group",
		path: [...widget.path, "widgets"],
		widgetIds: widget.children.map((child) => child.id),
		label: isSplit
			? i18n.t("dnd.list.splitIn", { where })
			: i18n.t("dnd.list.groupIn", { where }),
		ownerIds: [...ownerIds, widget.id],
	};
}

function nestedLists(
	widgets: readonly WidgetNode[],
	ownerIds: readonly string[],
	where: string,
): WidgetList[] {
	return widgets.flatMap((widget) => {
		const list = containerList(widget, ownerIds, where);
		return list
			? [list, ...nestedLists(widget.children, list.ownerIds, where)]
			: [];
	});
}

/**
 * Lists the drop targets of a page: head widgets first, then each column
 * followed by the split-columns and groups inside it. Head widgets are always
 * included so widgets can be dropped there even when the page has none yet.
 * Containers in head widgets get no list of their own (head widgets stay one row).
 * @param page - The open page.
 * @returns The page's widget lists.
 */
export function listsOfPage(page: PageNode): WidgetList[] {
	return [
		{
			id: `head:${page.id}`,
			kind: "head",
			path: [...page.path, "head-widgets"],
			widgetIds: page.headWidgets.map((widget) => widget.id),
			label: i18n.t("dnd.list.head"),
			ownerIds: [],
		},
		...page.columns.flatMap((column, index): WidgetList[] => {
			const label = i18n.t("dnd.list.column", { number: index + 1 });
			return [
				{
					id: column.id,
					kind: "column",
					path: [...column.path, "widgets"],
					widgetIds: column.widgets.map((widget) => widget.id),
					label,
					ownerIds: [],
				},
				...nestedLists(column.widgets, [], label),
			];
		}),
	];
}

/**
 * Tells whether a list may receive the dragged widget, following Glance's
 * rules (no group or split-column inside a group) and Glaze's (head widgets
 * hold no split-column, and nothing is dropped inside itself).
 * @param list - A drop list.
 * @param subject - What is being dragged.
 * @returns True when the list accepts the drop.
 */
export function acceptsDrop(list: WidgetList, subject: DragSubject): boolean {
	if (subject.widgetId !== null && list.ownerIds.includes(subject.widgetId)) {
		return false;
	}
	const isContainer =
		subject.type === "group" || subject.type === "split-column";
	if (list.kind === "group" && isContainer) return false;
	if (list.kind === "head" && subject.type === "split-column") return false;
	return true;
}

/**
 * Finds the list and position of a widget (top-level or inside a split-column / group).
 * @param lists - The page's lists.
 * @param widgetId - The widget to look for.
 * @returns Its list and index, or `null` when it isn't in any list of this page.
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
 * Finds the drop position under the pointer: the innermost list that accepts
 * the dragged widget, then either "beside" a widget (its left or right edge,
 * in columns only) or a slot between widgets. Everything has hysteresis
 * around the `previous` target: the list edge (`stickyListAtPoint`), the
 * beside bands (`besideAt`) and the slot midpoints (`slotAt`).
 * @param lists - The page's lists.
 * @param geometry - The same lists as measured on screen, items in display order.
 * @param point - The pointer, in viewport coordinates.
 * @param previous - The current target, or `null`.
 * @param subject - What is being dragged.
 * @param direction - The UI direction (rows and beside sides mirror in RTL).
 * @returns The drop position, or `null` when the pointer is over no accepting list.
 */
export function pointerTarget(
	lists: readonly WidgetList[],
	geometry: readonly ListGeometry[],
	point: Point,
	previous: DropTarget | null,
	subject: DragSubject,
	direction: TextDirection = "ltr",
): DropTarget | null {
	const accepting = new Map(
		lists
			.filter((list) => acceptsDrop(list, subject))
			.map((list) => [list.id, list]),
	);
	const measured = stickyListAtPoint(
		geometry.filter((candidate) => accepting.has(candidate.id)),
		point,
		previous?.listId ?? null,
	);
	const list = measured ? accepting.get(measured.id) : undefined;
	if (!measured || !list) return null;
	const same = previous?.listId === list.id ? previous : null;
	if (list.kind === "column") {
		const beside = besideAt(
			measured.items,
			point,
			same?.side ? { index: same.index, side: same.side } : null,
			direction,
		);
		if (beside && list.widgetIds[beside.index] !== subject.widgetId) {
			return { listId: list.id, index: beside.index, side: beside.side };
		}
	}
	const kept = same && same.side === undefined ? same.index : null;
	return {
		listId: list.id,
		index: slotAt(measured.items, measured.layout, point, kept, direction),
	};
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
		target.side === undefined &&
		source.listId === target.listId &&
		(target.index === source.index || target.index === source.index + 1)
	);
}

/**
 * Converts a drop position as shown on screen into the index `moveWidget`
 * (and `addWidget`) in `@glaze/core` expect: core counts positions after the
 * widget was taken out, so moving down within the same list shifts by one.
 * @param source - Where the dragged widget is now, or `null` for a library item.
 * @param target - Where it is dropped (a slot, not a "beside" target).
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
 * Moves a keyboard drag one step. Navigation is logical, not geometric, so it
 * can't skip a position or get stuck between two widgets of different heights:
 * - Up/Down move one position within a column (Left/Right within head widgets);
 * - Left/Right jump to the neighbouring column, at about the same position;
 * - Up from the top of a column goes to the end of the head widgets,
 *   Down from the head widgets goes to the top of the first column;
 * - a step that would only move between the two "no change" positions around
 *   the dragged widget itself skips one further.
 * Left and Right follow the reading direction: in RTL, ArrowLeft goes to the
 * next column and further along the head widgets.
 * Keyboard drags stay in head widgets and columns; widths and split-columns
 * have their own keyboard controls (the Style tab).
 * @param lists - The page's lists, head widgets first.
 * @param current - Current drop position, or `null` when nothing is targeted yet.
 * @param source - Where the dragged widget is, or `null` for a library item.
 * @param pressed - The arrow key that was pressed.
 * @param direction - The UI direction.
 * @returns The new drop position, or `null` to stay where it is.
 */
export function nextKeyboardTarget(
	lists: readonly WidgetList[],
	current: DropTarget | null,
	source: DropTarget | null,
	pressed: ArrowKey,
	direction: TextDirection = "ltr",
): DropTarget | null {
	const key = logicalKey(pressed, direction);
	const columns = lists.filter((list) => list.kind === "column");
	const head = lists.find(isHeadList);
	const list = current
		? lists.find((candidate) => candidate.id === current.listId)
		: undefined;
	if (!current || !list || (list.kind !== "column" && list.kind !== "head")) {
		const first = columns[0] ?? head;
		return first ? { listId: first.id, index: 0 } : null;
	}

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
