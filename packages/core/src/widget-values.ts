/*
 * Edits of values inside a map: below a widget's options (one monitor
 * site's `url`), a page's options, or the top-level sections of the config
 * (`server.port`, `theme.presets`). They patch only the touched node, so
 * comments and the formatting of neighbouring list items stay as they are.
 */
import {
	isAlias,
	isMap,
	isNode,
	isSeq,
	type YAMLMap,
	type YAMLSeq,
} from "yaml";
import type { GlazeDocument } from "./document.ts";
import { finishEdit, moveItem, splitItemPath } from "./edit.ts";
import { err, ok, type Result } from "./result.ts";
import {
	editError,
	insertSeqItem,
	removeMapEntry,
	removeSeqItem,
	renderItem,
	setMapEntry,
	setSeqItem,
} from "./text-edit.ts";
import type { EditError, YamlPath } from "./types.ts";
import { WIDGET_LISTS } from "./widgets.ts";
import {
	getMapValue,
	getNodeAt,
	isMergeKey,
	pairKey,
	readInclude,
} from "./yaml-read.ts";

/** The node a sub-path points at, and the collection that holds it. */
interface Target {
	/** Absolute path of `collection`. */
	readonly parent: YamlPath;
	readonly last: string | number;
	readonly collection: YAMLMap | YAMLSeq;
	/** Current value at the sub-path; `undefined` when the map key is missing. */
	readonly node: unknown;
	/**
	 * Segments after a missing key `last`, e.g. `["username"]` when
	 * `["basic-auth", "username"]` is set on a site without `basic-auth`.
	 */
	readonly rest: YamlPath;
}

function ownPair(map: YAMLMap, key: string) {
	return map.items.find(
		(pair) => !isMergeKey(pair.key) && String(pairKey(pair.key)) === key,
	);
}

/**
 * The keys below a base map that hold pages, columns or widgets. Those have
 * Glaze ids, which only the structural edits (addWidget, movePage, …) keep
 * in step, so value edits may not touch them.
 * @param basePath - The document root (`[]`), a page, or a widget.
 * @returns The protected keys, or why the path can't be a base.
 */
function structuralKeys(
	basePath: YamlPath,
): Result<readonly string[], EditError> {
	if (basePath.length === 0) return ok(["pages"]);
	if (
		basePath.length === 2 &&
		basePath[0] === "pages" &&
		typeof basePath[1] === "number"
	) {
		return ok(["columns", "head-widgets"]);
	}
	const item = splitItemPath(basePath, WIDGET_LISTS);
	if (!item.ok) {
		return err(
			editError(
				"invalid-path",
				`${JSON.stringify(basePath)} is not the document root, a page or a widget`,
			),
		);
	}
	return ok(WIDGET_LISTS);
}

/**
 * Walks `subPath` from a base map (the document root, a page or a widget),
 * refusing paths that would edit an anchor through a merge key or an alias,
 * or that lead into pages, columns or child widgets. It stops at the first
 * missing map key and returns the segments after it in `rest`.
 */
function resolveTarget(
	doc: GlazeDocument,
	basePath: YamlPath,
	subPath: YamlPath,
): Result<Target, EditError> {
	const protectedKeys = structuralKeys(basePath);
	if (!protectedKeys.ok) return protectedKeys;
	const [first] = subPath;
	if (first === undefined) {
		return err(editError("invalid-path", "The sub-path is empty"));
	}
	if (protectedKeys.value.some((key) => key === first)) {
		// Pages, columns and widgets have ids; only the structural edits keep those in step.
		return err(
			editError(
				"invalid-path",
				`"${first}" holds pages, columns or widgets; edit those with their own edits (addWidget, moveWidget, …)`,
			),
		);
	}
	const widget = getNodeAt(doc.yaml, basePath);
	if (isAlias(widget)) {
		return err(
			editError(
				"widget-is-alias",
				"This item is an alias (*name); edit the anchored item instead",
			),
		);
	}
	if (readInclude(widget) !== null) {
		return err(
			editError(
				"unsupported-structure",
				"This item is an include; edit the included file instead",
			),
		);
	}
	if (!isMap(widget)) {
		return err(editError("not-found", `No map at ${JSON.stringify(basePath)}`));
	}
	const where = (i: number) => JSON.stringify(subPath.slice(0, i + 1));
	let current: unknown = widget;
	for (const [i, segment] of subPath.entries()) {
		const parent = [...basePath, ...subPath.slice(0, i)];
		const isLast = i === subPath.length - 1;
		let child: unknown;
		if (isMap(current)) {
			if (typeof segment !== "string") {
				return err(editError("invalid-path", `${where(i)} expects a key`));
			}
			if (segment === "<<") {
				return err(
					editError("unsupported-structure", "Merge keys can't be edited"),
				);
			}
			const pair = ownPair(current, segment);
			if (!pair) {
				if (getMapValue(doc.yaml, current, segment) !== undefined) {
					return err(
						editError(
							"option-inherited",
							`${where(i)} comes from a merge key (<<: *anchor); override it on the widget instead`,
						),
					);
				}
				return ok({
					parent,
					last: segment,
					collection: current,
					node: undefined,
					rest: subPath.slice(i + 1),
				});
			}
			child = pair.value;
		} else if (isSeq(current)) {
			if (typeof segment !== "number") {
				return err(editError("invalid-path", `${where(i)} expects an index`));
			}
			child = current.items[segment];
			if (child === undefined) {
				return err(
					editError("index-out-of-range", `${where(i)} doesn't exist`),
				);
			}
		} else {
			return err(
				editError("not-found", `${where(i)} is not inside a map or list`),
			);
		}
		if (isAlias(child)) {
			return err(
				editError(
					"option-is-alias",
					`${where(i)} is an alias (*name); edit the anchored value instead`,
				),
			);
		}
		if (isLast) {
			return ok({
				parent,
				last: segment,
				collection: current,
				node: child,
				rest: [],
			});
		}
		current = child;
	}
	return err(editError("invalid-path", "The sub-path is empty"));
}

/** Deep equality for plain JS values as produced by `toJS`. */
function sameValue(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/** Refuses a target whose key is missing somewhere before the end of the sub-path. */
function requireFullPath(
	target: Target,
	subPath: YamlPath,
): Result<Target, EditError> {
	if (target.rest.length === 0) return ok(target);
	return err(
		editError(
			"not-found",
			`${JSON.stringify(subPath.slice(0, subPath.length - target.rest.length))} is not set`,
		),
	);
}

/** Wraps `value` in maps for the keys in `keys`: `["a", "b"]`, 1 → `{ a: { b: 1 } }`. */
function nestValue(keys: readonly string[], value: unknown): unknown {
	return keys.reduceRight<unknown>((inner, key) => ({ [key]: inner }), value);
}

/**
 * Sets a value below a widget, a page or the document root: a map key (`["sites", 2, "url"]`) or a list
 * item (`["repositories", 0]`). One-line scalars are replaced in place, so a
 * trailing comment and the quote style survive; other values replace that
 * node's block. Missing keys are added, also nested ones: setting
 * `["sites", 0, "basic-auth", "username"]` creates `basic-auth`. Missing list
 * items are never created.
 * @param doc - The document to edit.
 * @param basePath - The map the sub-path starts at: a widget, a page, or `[]` for the document root.
 * @param subPath - Path below it; not into pages, columns or child widgets.
 * @param value - Plain JS value.
 * @returns The new document, or why the value couldn't be set.
 */
export function setValueAt(
	doc: GlazeDocument,
	basePath: YamlPath,
	subPath: YamlPath,
	value: unknown,
): Result<GlazeDocument, EditError> {
	const target = resolveTarget(doc, basePath, subPath);
	if (!target.ok) return target;
	const { parent, last, rest } = target.value;
	const keys = rest.filter((segment) => typeof segment === "string");
	if (keys.length !== rest.length) {
		const full = requireFullPath(target.value, subPath);
		if (!full.ok) return full;
	}
	const source =
		typeof last === "string"
			? setMapEntry(doc.source, doc.yaml, parent, last, nestValue(keys, value))
			: setSeqItem(doc.source, doc.yaml, parent, last, value);
	if (!source.ok) return source;
	const next = finishEdit(doc, source.value, null);
	if (!next.ok) return next;
	// Safety net: the patched text must read back as exactly the requested value.
	const written = getNodeAt(next.value.yaml, [...basePath, ...subPath]);
	const actual: unknown = isNode(written)
		? written.toJS(next.value.yaml)
		: written;
	if (!sameValue(actual, value)) {
		return err(
			editError(
				"invalid-result",
				`The edit would not store ${JSON.stringify(value)} at ${JSON.stringify(subPath)}`,
			),
		);
	}
	return next;
}

/**
 * Removes a value below a widget, a page or the document root: a map key with its block, or a list item.
 * Comment lines directly above a removed list item go with it.
 * @param doc - The document to edit.
 * @param basePath - The map the sub-path starts at: a widget, a page, or `[]` for the document root.
 * @param subPath - Path below it, e.g. `["sites", 1, "icon"]` or `["sites", 1]`.
 * @returns The new document, or why the value couldn't be removed.
 */
export function removeValueAt(
	doc: GlazeDocument,
	basePath: YamlPath,
	subPath: YamlPath,
): Result<GlazeDocument, EditError> {
	const target = resolveTarget(doc, basePath, subPath);
	if (!target.ok) return target;
	const { parent, last, node, rest } = target.value;
	if (node === undefined || rest.length > 0) {
		return err(
			editError("option-not-found", `${JSON.stringify(subPath)} is not set`),
		);
	}
	if (typeof last === "string") {
		const source = removeMapEntry(doc.source, doc.yaml, parent, last);
		if (!source.ok) return source;
		return finishEdit(doc, source.value, null);
	}
	const removed = removeSeqItem(doc.source, doc.yaml, parent, last);
	if (!removed.ok) return removed;
	return finishEdit(doc, removed.value.source, null);
}

/**
 * Inserts an item into a list below a widget, a page or the document root, matching the indentation (and
 * blank-line spacing) of its siblings. Creates the list when it's missing.
 * @param doc - The document to edit.
 * @param basePath - The map the sub-path starts at: a widget, a page, or `[]` for the document root.
 * @param listSubPath - Path of the list below it, e.g. `["sites"]`.
 * @param value - The new item, as a plain JS value.
 * @param index - Position in the list; defaults to the end.
 * @returns The new document, or why the item couldn't be added.
 */
export function insertListItemAt(
	doc: GlazeDocument,
	basePath: YamlPath,
	listSubPath: YamlPath,
	value: unknown,
	index?: number,
): Result<GlazeDocument, EditError> {
	const resolved = resolveTarget(doc, basePath, listSubPath);
	if (!resolved.ok) return resolved;
	const target = requireFullPath(resolved.value, listSubPath);
	if (!target.ok) return target;
	if (typeof target.value.last !== "string") {
		return err(editError("invalid-path", "A list path must end with a key"));
	}
	const { node } = target.value;
	const at = index ?? (isSeq(node) ? node.items.length : 0);
	const eol = doc.source.includes("\r\n") ? "\r\n" : "\n";
	const source = insertSeqItem(
		doc.source,
		doc.yaml,
		[...basePath, ...listSubPath],
		at,
		renderItem(value, eol),
	);
	if (!source.ok) return source;
	return finishEdit(doc, source.value, null);
}

/**
 * Moves an item within a list below a widget, a page or the document root. The item keeps its text,
 * including the comment lines directly above it.
 * @param doc - The document to edit.
 * @param basePath - The map the sub-path starts at: a widget, a page, or `[]` for the document root.
 * @param listSubPath - Path of the list below it, e.g. `["sites"]`.
 * @param fromIndex - Index of the item.
 * @param toIndex - New position, counted without the moved item.
 * @returns The new document, or why the item couldn't be moved.
 */
export function moveListItemAt(
	doc: GlazeDocument,
	basePath: YamlPath,
	listSubPath: YamlPath,
	fromIndex: number,
	toIndex: number,
): Result<GlazeDocument, EditError> {
	const target = resolveTarget(doc, basePath, listSubPath);
	if (!target.ok) return target;
	const { node } = target.value;
	if (!isSeq(node)) {
		return err(
			editError("not-found", `${JSON.stringify(listSubPath)} is not a list`),
		);
	}
	const size = node.items.length;
	if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= size) {
		return err(
			editError("index-out-of-range", `No item ${fromIndex} in the list`),
		);
	}
	if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= size) {
		return err(
			editError(
				"index-out-of-range",
				`Index ${toIndex} is outside 0..${size - 1}`,
			),
		);
	}
	if (fromIndex === toIndex) return ok(doc);
	const list = [...basePath, ...listSubPath];
	return moveItem(doc, list, fromIndex, list, toIndex);
}

/**
 * Sets a value below a widget's options (see `setValueAt`).
 * @param doc - The document to edit.
 * @param widgetPath - Path of the widget.
 * @param subPath - Path below the widget; not into child `widgets`.
 * @param value - Plain JS value.
 * @returns The new document, or why the value couldn't be set.
 */
export function setWidgetValue(
	doc: GlazeDocument,
	widgetPath: YamlPath,
	subPath: YamlPath,
	value: unknown,
): Result<GlazeDocument, EditError> {
	const item = splitItemPath(widgetPath, WIDGET_LISTS);
	return item.ok ? setValueAt(doc, widgetPath, subPath, value) : item;
}

/**
 * Removes a value below a widget's options (see `removeValueAt`).
 * @param doc - The document to edit.
 * @param widgetPath - Path of the widget.
 * @param subPath - Path below the widget.
 * @returns The new document, or why the value couldn't be removed.
 */
export function removeWidgetValue(
	doc: GlazeDocument,
	widgetPath: YamlPath,
	subPath: YamlPath,
): Result<GlazeDocument, EditError> {
	const item = splitItemPath(widgetPath, WIDGET_LISTS);
	return item.ok ? removeValueAt(doc, widgetPath, subPath) : item;
}

/**
 * Inserts an item into a list option of a widget (see `insertListItemAt`).
 * @param doc - The document to edit.
 * @param widgetPath - Path of the widget.
 * @param listSubPath - Path of the list below the widget, e.g. `["sites"]`.
 * @param value - The new item.
 * @param index - Position in the list; defaults to the end.
 * @returns The new document, or why the item couldn't be added.
 */
export function insertWidgetListItem(
	doc: GlazeDocument,
	widgetPath: YamlPath,
	listSubPath: YamlPath,
	value: unknown,
	index?: number,
): Result<GlazeDocument, EditError> {
	const item = splitItemPath(widgetPath, WIDGET_LISTS);
	return item.ok
		? insertListItemAt(doc, widgetPath, listSubPath, value, index)
		: item;
}

/**
 * Moves an item within a list option of a widget (see `moveListItemAt`).
 * @param doc - The document to edit.
 * @param widgetPath - Path of the widget.
 * @param listSubPath - Path of the list below the widget.
 * @param fromIndex - Index of the item.
 * @param toIndex - New position, counted without the moved item.
 * @returns The new document, or why the item couldn't be moved.
 */
export function moveWidgetListItem(
	doc: GlazeDocument,
	widgetPath: YamlPath,
	listSubPath: YamlPath,
	fromIndex: number,
	toIndex: number,
): Result<GlazeDocument, EditError> {
	const item = splitItemPath(widgetPath, WIDGET_LISTS);
	return item.ok
		? moveListItemAt(doc, widgetPath, listSubPath, fromIndex, toIndex)
		: item;
}
