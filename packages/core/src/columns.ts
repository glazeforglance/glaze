import { isSeq } from "yaml";
import type { GlazeDocument } from "./document.ts";
import { finishEdit, splitItemPath } from "./edit.ts";
import type { Result } from "./result.ts";
import {
	insertSeqItem,
	removeSeqItem,
	renderItem,
	setMapEntry,
} from "./text-edit.ts";
import type { ColumnSize, EditError, YamlPath } from "./types.ts";
import { getNodeAt } from "./yaml-read.ts";

/**
 * Adds an empty column to a page. Refused when it breaks a layout rule
 * (too many columns, or a third `full` column).
 * @param doc - The document to edit.
 * @param pagePath - Path of the page, e.g. `["pages", 0]`.
 * @param size - Size of the new column.
 * @param index - Position among the columns; defaults to the end.
 * @returns The new document, or why the column couldn't be added.
 */
export function addColumn(
	doc: GlazeDocument,
	pagePath: YamlPath,
	size: ColumnSize,
	index?: number,
): Result<GlazeDocument, EditError> {
	const page = splitItemPath(pagePath, ["pages"]);
	if (!page.ok) return page;
	const seq = [...pagePath, "columns"];
	const columns = getNodeAt(doc.yaml, seq);
	const at = index ?? (isSeq(columns) ? columns.items.length : 0);
	const eol = doc.source.includes("\r\n") ? "\r\n" : "\n";
	const source = insertSeqItem(
		doc.source,
		doc.yaml,
		seq,
		at,
		renderItem({ size }, eol),
	);
	if (!source.ok) return source;
	return finishEdit(doc, source.value, { kind: "insert", seq, index: at });
}

/**
 * Removes a column and its widgets. Refused when the page would be left
 * without columns or without a `full` column.
 * @param doc - The document to edit.
 * @param columnPath - Path of the column, e.g. `["pages", 0, "columns", 1]`.
 * @returns The new document, or why the column couldn't be removed.
 */
export function removeColumn(
	doc: GlazeDocument,
	columnPath: YamlPath,
): Result<GlazeDocument, EditError> {
	const item = splitItemPath(columnPath, ["columns"]);
	if (!item.ok) return item;
	const { seq, index } = item.value;
	const removed = removeSeqItem(doc.source, doc.yaml, seq, index);
	if (!removed.ok) return removed;
	return finishEdit(doc, removed.value.source, { kind: "remove", seq, index });
}

/**
 * Sets a column's `size`. Refused when the page would end up with 0 or 3 `full` columns.
 * @param doc - The document to edit.
 * @param columnPath - Path of the column.
 * @param size - The new size.
 * @returns The new document, or why the size couldn't be changed.
 */
export function setColumnSize(
	doc: GlazeDocument,
	columnPath: YamlPath,
	size: ColumnSize,
): Result<GlazeDocument, EditError> {
	const item = splitItemPath(columnPath, ["columns"]);
	if (!item.ok) return item;
	const source = setMapEntry(doc.source, doc.yaml, columnPath, "size", size);
	if (!source.ok) return source;
	return finishEdit(doc, source.value, null);
}
