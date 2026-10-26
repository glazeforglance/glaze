import { isMap, isNode, isPair, type Node } from "yaml";
import type { GlazeDocument } from "./document.ts";
import { listNodePaths, type NodeKind } from "./model.ts";
import type { YamlPath } from "./types.ts";
import { getNodeAt, isMergeKey, pairKey } from "./yaml-read.ts";

/** Where a node sits in the source text. */
export interface NodeRange {
	/** Offset of the first character (the `- ` of a list item, the key of an option). */
	readonly from: number;
	/** Offset just after the last character of the value (trailing comments excluded). */
	readonly to: number;
	/** 1-based line of `from`. */
	readonly startLine: number;
	/** 1-based line of the last character. */
	readonly endLine: number;
}

/** A 1-based line and column. */
export interface LineColumn {
	readonly line: number;
	readonly column: number;
}

/**
 * Converts a character offset into a 1-based line and column.
 * @param text - The source text.
 * @param offset - Character offset; clamped to the text.
 * @returns Line and column of that offset.
 */
export function offsetToLineColumn(text: string, offset: number): LineColumn {
	const end = Math.max(0, Math.min(offset, text.length));
	let line = 1;
	let lineStart = 0;
	for (let i = 0; i < end; i++) {
		if (text[i] === "\n") {
			line += 1;
			lineStart = i + 1;
		}
	}
	return { line, column: end - lineStart + 1 };
}

/** Moves `start` back over spaces to the `-` of a block list item, if there is one. */
function itemStart(source: string, start: number): number {
	let i = start;
	while (i > 0 && source[i - 1] === " ") i -= 1;
	return i > 0 && source[i - 1] === "-" ? i - 1 : start;
}

/** Finds the pair for `key` in the map at `mapPath` (own keys only). */
function findPair(doc: GlazeDocument, mapPath: YamlPath, key: string) {
	const map = getNodeAt(doc.yaml, mapPath);
	if (!isMap(map)) return undefined;
	return map.items.find(
		(pair) =>
			isPair(pair) &&
			(pairKey(pair.key) === key || (key === "<<" && isMergeKey(pair.key))),
	);
}

function rangeOf(node: unknown): [number, number] | null {
	if (!isNode(node)) return null;
	const range = (node as Node).range;
	return range ? [range[0], range[1]] : null;
}

/** Start and end offsets of a node, without line numbers (cheap). */
function nodeSpan(doc: GlazeDocument, path: YamlPath): [number, number] | null {
	const { source } = doc;
	const last = path[path.length - 1];
	let span: [number, number] | null = null;
	if (typeof last === "string") {
		const pair = findPair(doc, path.slice(0, -1), last);
		const keyRange = pair ? rangeOf(pair.key) : null;
		if (pair && keyRange) {
			const valueRange = rangeOf(pair.value);
			// An empty value (`sites:`) has a zero-width range; the key is then the whole option.
			const end =
				valueRange && valueRange[1] > keyRange[1] ? valueRange[1] : keyRange[1];
			span = [keyRange[0], end];
		}
	} else {
		span = rangeOf(
			path.length === 0 ? doc.yaml.contents : getNodeAt(doc.yaml, path),
		);
		if (span && typeof last === "number")
			span = [itemStart(source, span[0]), span[1]];
	}
	if (!span) return null;
	const [from] = span;
	let [, to] = span;
	// Block collections end after their last line break; that belongs to the next line.
	while (to > from && (source[to - 1] === "\n" || source[to - 1] === "\r")) {
		to -= 1;
	}
	return [from, to];
}

/**
 * Locates a page, column, widget or option in the source text, using the
 * ranges the `yaml` parser records. Used for "jump to widget" and to put
 * validation messages on the right line.
 * - For a list item (a number at the end of the path) the range starts at its `- `.
 * - For an option (a string at the end) it runs from the key to the end of the value.
 * @param doc - The document.
 * @param path - Path of the node, e.g. `["pages", 0, "columns", 1, "widgets", 2]`.
 * @returns The range, or `null` when nothing is at `path` (or it is inside an alias).
 */
export function getNodeRange(
	doc: GlazeDocument,
	path: YamlPath,
): NodeRange | null {
	const span = nodeSpan(doc, path);
	if (!span) return null;
	const [from, to] = span;
	return {
		from,
		to,
		startLine: offsetToLineColumn(doc.source, from).line,
		endLine: offsetToLineColumn(doc.source, Math.max(from, to - 1)).line,
	};
}

/** A page, column or widget found at a cursor position. */
export interface PathAtOffset {
	readonly kind: NodeKind;
	readonly path: YamlPath;
}

/**
 * Finds the deepest widget, column or page that contains a cursor position,
 * so moving the cursor in the code view can select the matching widget.
 * @param doc - The document; `offset` must refer to `doc.source`.
 * @param offset - Character offset of the cursor.
 * @returns The innermost node, or `null` when the cursor is outside every page.
 */
export function findPathAtOffset(
	doc: GlazeDocument,
	offset: number,
): PathAtOffset | null {
	let best: PathAtOffset | null = null;
	for (const { path, kind } of listNodePaths(doc.yaml)) {
		// Spans only: line numbers aren't needed here, and this runs on every cursor move.
		const span = nodeSpan(doc, path);
		if (!span || offset < span[0] || offset > span[1]) continue;
		if (!best || path.length > best.path.length) best = { kind, path };
	}
	return best;
}
