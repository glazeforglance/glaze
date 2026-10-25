import { isNode, isSeq } from "yaml";
import type { GlazeDocument } from "./document.ts";
import { checkListPath, finishEdit, moveItem, splitItemPath } from "./edit.ts";
import { err, type Result } from "./result.ts";
import {
	editError,
	insertSeqItem,
	removeMapEntry,
	removeSeqItem,
	renderItem,
	setMapEntry,
} from "./text-edit.ts";
import type { EditError, YamlPath } from "./types.ts";
import { getNodeAt } from "./yaml-read.ts";

/** A new widget: its `type` plus any options, in the order they should be written. */
export interface WidgetInput {
	readonly type: string;
	readonly [option: string]: unknown;
}

/** Keys of lists that hold widgets: columns, head widgets, and group / split-column children. */
const WIDGET_LISTS = ["widgets", "head-widgets"] as const;

function listLength(doc: GlazeDocument, seq: YamlPath): number {
	const list = getNodeAt(doc.yaml, seq);
	return isSeq(list) ? list.items.length : 0;
}

/**
 * Adds a widget to a list (a column's `widgets`, a page's `head-widgets`, or
 * the `widgets` of a group / split-column). Refused when it breaks a layout
 * rule, e.g. a group inside a group.
 * @param doc - The document to edit.
 * @param listPath - Path of the list, e.g. `["pages", 0, "columns", 1, "widgets"]`.
 * @param widget - The widget to add.
 * @param index - Position in the list; defaults to the end.
 * @returns The new document, or why the widget couldn't be added.
 */
export function addWidget(
	doc: GlazeDocument,
	listPath: YamlPath,
	widget: WidgetInput,
	index?: number,
): Result<GlazeDocument, EditError> {
	const seq = checkListPath(listPath, WIDGET_LISTS);
	if (!seq.ok) return seq;
	const at = index ?? listLength(doc, listPath);
	const eol = doc.source.includes("\r\n") ? "\r\n" : "\n";
	const source = insertSeqItem(
		doc.source,
		doc.yaml,
		listPath,
		at,
		renderItem(widget, eol),
	);
	if (!source.ok) return source;
	return finishEdit(doc, source.value, {
		kind: "insert",
		seq: listPath,
		index: at,
	});
}

/**
 * Removes a widget (with its children, for a group or split-column).
 * @param doc - The document to edit.
 * @param widgetPath - Path of the widget.
 * @returns The new document, or why the widget couldn't be removed.
 */
export function removeWidget(
	doc: GlazeDocument,
	widgetPath: YamlPath,
): Result<GlazeDocument, EditError> {
	const item = splitItemPath(widgetPath, WIDGET_LISTS);
	if (!item.ok) return item;
	const { seq, index } = item.value;
	const removed = removeSeqItem(doc.source, doc.yaml, seq, index);
	if (!removed.ok) return removed;
	return finishEdit(doc, removed.value.source, { kind: "remove", seq, index });
}

/**
 * Inserts a copy of a widget right after it. The copy is written from the
 * widget's values (merge keys resolved), not copied as text: a text copy would
 * define its `&anchor` a second time, and aliases further down the file would
 * then silently point at the copy. Comments inside the widget are not copied.
 * @param doc - The document to edit.
 * @param widgetPath - Path of the widget to copy.
 * @returns The new document, or why the widget couldn't be copied.
 */
export function duplicateWidget(
	doc: GlazeDocument,
	widgetPath: YamlPath,
): Result<GlazeDocument, EditError> {
	const item = splitItemPath(widgetPath, WIDGET_LISTS);
	if (!item.ok) return item;
	const { seq, index } = item.value;
	const node = getNodeAt(doc.yaml, widgetPath);
	const value: unknown = isNode(node) ? node.toJS(doc.yaml) : undefined;
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return err(
			editError("not-found", `No widget at ${JSON.stringify(widgetPath)}`),
		);
	}
	const eol = doc.source.includes("\r\n") ? "\r\n" : "\n";
	const source = insertSeqItem(
		doc.source,
		doc.yaml,
		seq,
		index + 1,
		renderItem(value, eol),
	);
	if (!source.ok) return source;
	return finishEdit(doc, source.value, {
		kind: "insert",
		seq,
		index: index + 1,
	});
}

/**
 * Moves a widget within its list or to another widget list, on any page.
 * @param doc - The document to edit.
 * @param widgetPath - Path of the widget.
 * @param toListPath - Target list, as a path in `doc` before the move.
 * @param toIndex - Position in the target list, counted without the moved widget.
 * @returns The new document, or why the widget couldn't be moved.
 */
export function moveWidget(
	doc: GlazeDocument,
	widgetPath: YamlPath,
	toListPath: YamlPath,
	toIndex: number,
): Result<GlazeDocument, EditError> {
	const item = splitItemPath(widgetPath, WIDGET_LISTS);
	if (!item.ok) return item;
	const target = checkListPath(toListPath, WIDGET_LISTS);
	if (!target.ok) return target;
	return moveItem(doc, item.value.seq, item.value.index, toListPath, toIndex);
}

/**
 * Sets one option of a widget, e.g. `title` or `cache`. Existing scalar values
 * are replaced in place; new options are added after the widget's last option.
 * @param doc - The document to edit.
 * @param widgetPath - Path of the widget.
 * @param key - Option name.
 * @param value - Plain JS value (string, number, boolean, null, array or object).
 * @returns The new document, or why the option couldn't be set.
 */
export function setWidgetOption(
	doc: GlazeDocument,
	widgetPath: YamlPath,
	key: string,
	value: unknown,
): Result<GlazeDocument, EditError> {
	const item = splitItemPath(widgetPath, WIDGET_LISTS);
	if (!item.ok) return item;
	if (key === "<<")
		return err(
			editError("unsupported-structure", "Merge keys can't be set as options"),
		);
	const source = setMapEntry(doc.source, doc.yaml, widgetPath, key, value);
	if (!source.ok) return source;
	return finishEdit(doc, source.value, null);
}

/**
 * Removes an option the widget sets itself. Options that only come from a
 * merge key (`<<: *anchor`) can't be removed here.
 * @param doc - The document to edit.
 * @param widgetPath - Path of the widget.
 * @param key - Option name.
 * @returns The new document, or why the option couldn't be removed.
 */
export function removeWidgetOption(
	doc: GlazeDocument,
	widgetPath: YamlPath,
	key: string,
): Result<GlazeDocument, EditError> {
	const item = splitItemPath(widgetPath, WIDGET_LISTS);
	if (!item.ok) return item;
	const source = removeMapEntry(doc.source, doc.yaml, widgetPath, key);
	if (!source.ok) return source;
	return finishEdit(doc, source.value, null);
}
