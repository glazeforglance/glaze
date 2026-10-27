/*
 * Widget width, the Glance way. Glance has no width per widget; widgets sit
 * side by side only inside a `split-column`, which draws `max-columns`
 * equal-width columns. These edits build, grow, resize and dissolve
 * split-columns. Whole item texts move (comments and anchors included), so
 * nothing outside the touched widgets changes.
 */
import { isAlias, isMap, isSeq } from "yaml";
import type { GlazeDocument } from "./document.ts";
import { finishEdit, splitItemPath } from "./edit.ts";
import { type PathChange, pathAfterRemoval, startsWith } from "./ids.ts";
import { pathKey } from "./model.ts";
import { err, ok, type Result } from "./result.ts";
import {
	detectEol,
	editError,
	indent,
	insertSeqItem,
	isSeparatedList,
	readSeqItem,
	removeSeqItem,
	renderItem,
} from "./text-edit.ts";
import type { EditError, YamlPath } from "./types.ts";
import {
	addWidget,
	moveWidget,
	setWidgetOption,
	WIDGET_LISTS,
	type WidgetInput,
} from "./widgets.ts";
import {
	getNodeAt,
	type ParsedYaml,
	parseYamlDocument,
	readString,
	resolveNode,
} from "./yaml-read.ts";

/** The widget that goes into a split-column: a new one, or one moved from elsewhere. */
export type SplitSource =
	| { readonly kind: "new"; readonly widget: WidgetInput }
	| { readonly kind: "move"; readonly path: YamlPath };

/** Which side of the target widget the other widget goes. */
export type SplitSide = "left" | "right";

/** Glance's own minimum (and default) for `max-columns`. */
export const MIN_SPLIT_COLUMNS = 2;

const HEAD_MESSAGE =
	"Head widgets can't be split; put the widgets in a column instead";

function typeAt(doc: GlazeDocument, path: YamlPath): string | null {
	const node = resolveNode(doc.yaml, getNodeAt(doc.yaml, path));
	return isMap(node) ? readString(doc.yaml, node, "type") : null;
}

function requireSplitColumn(
	doc: GlazeDocument,
	path: YamlPath,
): Result<YamlPath, EditError> {
	const item = splitItemPath(path, WIDGET_LISTS);
	if (!item.ok) return item;
	if (isAlias(getNodeAt(doc.yaml, path))) {
		return err(
			editError(
				"widget-is-alias",
				"This item is an alias (*name); edit the anchored item instead",
			),
		);
	}
	if (typeAt(doc, path) !== "split-column") {
		return err(
			editError("not-found", `No split-column at ${JSON.stringify(path)}`),
		);
	}
	return ok(path);
}

function reparse(source: string): Result<ParsedYaml, EditError> {
	const yaml = parseYamlDocument(source);
	return yaml.errors.length > 0
		? err(editError("invalid-result", "The edit would break the YAML"))
		: ok(yaml);
}

function childCount(yaml: ParsedYaml, seq: YamlPath): number {
	const list = getNodeAt(yaml, seq);
	return isSeq(list) ? list.items.length : 0;
}

/**
 * The text of a new split-column item holding the given (column-0) item
 * texts, separated by blank lines when the surrounding list does that too.
 */
function splitColumnItem(
	children: readonly string[],
	columns: number,
	separated: boolean,
	eol: string,
): string {
	const body = children
		.map((text) => {
			const lines = text.replace(/\r?\n/g, eol);
			return indent(lines.endsWith(eol) ? lines : lines + eol, 4);
		})
		.join(separated ? eol : "");
	return (
		[
			"- type: split-column",
			`  max-columns: ${columns}`,
			"  widgets:",
			"",
		].join(eol) + body
	);
}

/**
 * Puts two widgets side by side: replaces `targetPath` with a new
 * `split-column` that holds the target and the other widget, on the given
 * side of it. The split-column takes the target's place. Comment lines above
 * the target stay with it.
 * @param doc - The document to edit.
 * @param targetPath - The widget to put something beside.
 * @param source - A new widget, the path of a widget to move there, or
 *   `null` to wrap the target alone (it then takes 1/`columns` of the width,
 *   with empty space next to it).
 * @param side - Where the other widget goes: left or right of the target.
 * @param columns - `max-columns` of the new split-column; 2 by default.
 * @returns The new document, or why the widgets can't be put side by side
 *   (e.g. inside a group, or in head widgets).
 */
export function wrapInSplitColumn(
	doc: GlazeDocument,
	targetPath: YamlPath,
	source: SplitSource | null,
	side: SplitSide,
	columns: number = MIN_SPLIT_COLUMNS,
): Result<GlazeDocument, EditError> {
	const target = splitItemPath(targetPath, WIDGET_LISTS);
	if (!target.ok) return target;
	if (target.value.seq[target.value.seq.length - 1] === "head-widgets") {
		return err(editError("layout-violation", HEAD_MESSAGE));
	}
	const eol = detectEol(doc.source);
	// The new split-column follows the style of the list it lands in.
	const separated = isSeparatedList(doc.source, doc.yaml, target.value.seq);
	const changes: PathChange[] = [];
	let source0 = doc.source;
	let yaml = doc.yaml;
	let seq = target.value.seq;
	let index = target.value.index;
	if (!Number.isInteger(columns) || columns < MIN_SPLIT_COLUMNS) {
		return err(
			editError(
				"invalid-result",
				`A split-column needs at least ${MIN_SPLIT_COLUMNS} columns`,
			),
		);
	}
	let otherText: string | null = null;

	if (source?.kind === "move") {
		const from = splitItemPath(source.path, WIDGET_LISTS);
		if (!from.ok) return from;
		if (startsWith(targetPath, source.path)) {
			return err(
				editError("invalid-move", "A widget can't be put beside itself"),
			);
		}
		const removed = removeSeqItem(
			source0,
			yaml,
			from.value.seq,
			from.value.index,
		);
		if (!removed.ok) return removed;
		changes.push({
			kind: "detach",
			seq: from.value.seq,
			index: from.value.index,
			as: "other",
		});
		otherText = removed.value.removed;
		source0 = removed.value.source;
		const parsed = reparse(source0);
		if (!parsed.ok) return parsed;
		yaml = parsed.value;
		// Taking the other widget out may shift the target up by one.
		const moved = pathAfterRemoval(
			targetPath,
			from.value.seq,
			from.value.index,
		);
		const shifted = moved ? splitItemPath(moved, WIDGET_LISTS) : null;
		if (!shifted?.ok) {
			return err(editError("invalid-move", "The target widget moved away"));
		}
		seq = shifted.value.seq;
		index = shifted.value.index;
	} else if (source) {
		otherText = renderItem(source.widget, eol);
	}

	const removedTarget = removeSeqItem(source0, yaml, seq, index);
	if (!removedTarget.ok) return removedTarget;
	changes.push({ kind: "detach", seq, index, as: "target" });
	const between = reparse(removedTarget.value.source);
	if (!between.ok) return between;

	const targetText = removedTarget.value.removed;
	const pair =
		side === "left" ? [otherText, targetText] : [targetText, otherText];
	const item = splitColumnItem(
		pair.filter((text) => text !== null),
		columns,
		separated,
		eol,
	);
	const inserted = insertSeqItem(
		removedTarget.value.source,
		between.value,
		seq,
		index,
		item,
		separated,
	);
	if (!inserted.ok) return inserted;
	changes.push({ kind: "insert", seq, index });
	// Attach in final order (an attach shifts the items after it); a new
	// widget has no ids to carry and gets a fresh one.
	const children = [...seq, index, "widgets"];
	const order: ("other" | "target")[] =
		otherText === null
			? ["target"]
			: side === "left"
				? ["other", "target"]
				: ["target", "other"];
	for (const [position, name] of order.entries()) {
		if (name === "other" && source?.kind !== "move") continue;
		changes.push({ kind: "attach", seq: children, index: position, as: name });
	}
	return finishEdit(doc, inserted.value, changes);
}

/**
 * Adds a widget to an existing split-column (a new one, or one moved there).
 * @param doc - The document to edit.
 * @param splitPath - Path of the split-column.
 * @param source - A new widget, or the path of a widget to move into it.
 * @param index - Position among its widgets; defaults to the end.
 * @returns The new document, or why the widget couldn't be added.
 */
export function addToSplitColumn(
	doc: GlazeDocument,
	splitPath: YamlPath,
	source: SplitSource,
	index?: number,
): Result<GlazeDocument, EditError> {
	const split = requireSplitColumn(doc, splitPath);
	if (!split.ok) return split;
	const children = [...splitPath, "widgets"];
	if (source.kind === "new") {
		return addWidget(doc, children, source.widget, index);
	}
	// Counted without the moved widget, when it already is one of the children.
	const inside = pathKey(source.path.slice(0, -1)) === pathKey(children);
	const end = childCount(doc.yaml, children) - (inside ? 1 : 0);
	return moveWidget(doc, source.path, children, index ?? end);
}

/**
 * Dissolves a split-column: its widgets take its place in the parent list,
 * in order. Comment lines above the split-column move to its first widget;
 * comments on the split-column's own keys (`max-columns`) go with it.
 * @param doc - The document to edit.
 * @param splitPath - Path of the split-column.
 * @returns The new document, or why the split-column couldn't be dissolved.
 */
export function unwrapSplitColumn(
	doc: GlazeDocument,
	splitPath: YamlPath,
): Result<GlazeDocument, EditError> {
	const split = requireSplitColumn(doc, splitPath);
	if (!split.ok) return split;
	const item = splitItemPath(splitPath, WIDGET_LISTS);
	if (!item.ok) return item;
	const { seq, index } = item.value;
	const childrenSeq = [...splitPath, "widgets"];
	const count = childCount(doc.yaml, childrenSeq);
	const texts: string[] = [];
	for (let k = 0; k < count; k += 1) {
		const text = readSeqItem(doc.source, doc.yaml, childrenSeq, k);
		if (text === null) {
			return err(
				editError(
					"unsupported-structure",
					"The split-column's widgets can't be read (flow-style list?)",
				),
			);
		}
		texts.push(text);
	}
	const separated =
		isSeparatedList(doc.source, doc.yaml, childrenSeq) ||
		isSeparatedList(doc.source, doc.yaml, seq);
	const removed = removeSeqItem(doc.source, doc.yaml, seq, index);
	if (!removed.ok) return removed;
	const changes: PathChange[] = [];
	for (let k = 0; k < count; k += 1) {
		changes.push({ kind: "detach", seq: childrenSeq, index: 0, as: `${k}` });
	}
	changes.push({ kind: "remove", seq, index });

	// Comment lines above the split-column's dash describe the place; keep them.
	const lines = removed.value.removed.split(/(?<=\n)/);
	const dash = lines.findIndex((line) => line.startsWith("-"));
	const leading = lines.slice(0, Math.max(0, dash)).join("");

	let source = removed.value.source;
	for (const [k, text] of texts.entries()) {
		const parsed = reparse(source);
		if (!parsed.ok) return parsed;
		const inserted = insertSeqItem(
			source,
			parsed.value,
			seq,
			index + k,
			k === 0 ? leading + text : text,
			separated,
		);
		if (!inserted.ok) return inserted;
		source = inserted.value;
		changes.push({ kind: "attach", seq, index: index + k, as: `${k}` });
	}
	return finishEdit(doc, source, changes);
}

/**
 * Sets how many equal-width columns a split-column draws (`max-columns`).
 * Every widget in it gets the same width: Glance has no width per widget.
 * @param doc - The document to edit.
 * @param splitPath - Path of the split-column.
 * @param columns - A whole number, at least 2.
 * @returns The new document, or why the value couldn't be set.
 */
export function setSplitColumns(
	doc: GlazeDocument,
	splitPath: YamlPath,
	columns: number,
): Result<GlazeDocument, EditError> {
	const split = requireSplitColumn(doc, splitPath);
	if (!split.ok) return split;
	if (!Number.isInteger(columns) || columns < MIN_SPLIT_COLUMNS) {
		return err(
			editError(
				"invalid-result",
				`A split-column needs at least ${MIN_SPLIT_COLUMNS} columns`,
			),
		);
	}
	return setWidgetOption(doc, splitPath, "max-columns", columns);
}
