/*
 * Text-level edits on YAML source.
 *
 * The yaml package's `Document.toString()` re-formats the whole file (comment
 * alignment, indentation, flow spacing), so Glaze never uses it for output.
 * Instead we use the parsed document to *locate* nodes and then patch only those
 * bytes of the source. Everything outside the patched range stays identical.
 */
import {
	isAlias,
	isMap,
	isNode,
	isScalar,
	isSeq,
	Scalar,
	stringify,
	type YAMLMap,
	type YAMLSeq,
} from "yaml";
import { err, ok, type Result } from "./result.ts";
import type {
	EditError,
	EditErrorCode,
	LayoutIssue,
	YamlPath,
} from "./types.ts";
import { getNodeAt, type ParsedYaml } from "./yaml-read.ts";

/**
 * Creates an `EditError`.
 * @param code - Machine-readable reason.
 * @param message - Human-readable explanation.
 * @param issues - Layout issues, for `layout-violation`.
 * @returns The error object.
 */
export function editError(
	code: EditErrorCode,
	message: string,
	issues: readonly LayoutIssue[] = [],
): EditError {
	return { code, message, issues };
}

// --- line helpers ---------------------------------------------------------

/**
 * Detects the line ending a source uses.
 * @param src - YAML source.
 * @returns `

` when the source has any, else `
`.
 */
export function detectEol(src: string): string {
	return src.includes("\r\n") ? "\r\n" : "\n";
}

function lineStart(src: string, pos: number): number {
	return src.lastIndexOf("\n", pos - 1) + 1;
}

/** Offset just after the newline that ends the line containing `pos`. */
function lineEnd(src: string, pos: number): number {
	const newline = src.indexOf("\n", pos);
	return newline === -1 ? src.length : newline + 1;
}

function lineText(src: string, start: number): string {
	return src.slice(start, lineEnd(src, start)).replace(/\r?\n$/, "");
}

function isBlank(line: string): boolean {
	return line.trim() === "";
}

/** Number of leading spaces (YAML indents with spaces only). */
function indentOf(line: string): number {
	return line.length - line.replace(/^ +/, "").length;
}

/** True when `text` (whole lines) contains an empty or whitespace-only line. */
function hasBlankLine(text: string): boolean {
	return splitLines(text).some((line) => line !== "" && isBlank(line));
}

/**
 * End offset of a block that starts on the line at `firstLine`: the block
 * continues while lines are blank or indented deeper than `col`, and trailing
 * blank lines are not part of it.
 */
function blockContentEnd(src: string, firstLine: number, col: number): number {
	let contentEnd = lineEnd(src, firstLine);
	let pos = contentEnd;
	while (pos < src.length) {
		const line = lineText(src, pos);
		const next = lineEnd(src, pos);
		if (!isBlank(line)) {
			if (indentOf(line) <= col) break;
			contentEnd = next;
		}
		pos = next;
	}
	return contentEnd;
}

function splitLines(text: string): string[] {
	return text.split(/(?<=\n)/);
}

/** Removes up to `col` leading spaces from every line. */
function dedent(text: string, col: number): string {
	return splitLines(text)
		.map((line) => line.slice(Math.min(col, indentOf(line))))
		.join("");
}

/**
 * Adds `col` spaces to every non-blank line (optionally not the first one).
 * @param text - Lines of text.
 * @param col - Number of spaces to add.
 * @param skipFirst - Leaves the first line alone.
 * @returns The indented text.
 */
export function indent(text: string, col: number, skipFirst = false): string {
	const pad = " ".repeat(col);
	return splitLines(text)
		.map((line, i) =>
			isBlank(line) || (skipFirst && i === 0) ? line : pad + line,
		)
		.join("");
}

function withEol(text: string, eol: string): string {
	return text.replace(/\r?\n/g, eol);
}

function ensureTrailingEol(text: string, eol: string): string {
	return text.endsWith("\n") ? text : text + eol;
}

function splice(src: string, start: number, end: number, text: string): string {
	return src.slice(0, start) + text + src.slice(end);
}

// --- rendering ------------------------------------------------------------

const RENDER_OPTIONS = { lineWidth: 0 } as const;

/**
 * Renders a value as a sequence item at column 0 (`- ...`).
 * @param value - Plain JS value.
 * @param eol - Line ending to use.
 * @returns The item text, ending with a line break.
 */
export function renderItem(value: unknown, eol: string): string {
	return withEol(stringify([value], RENDER_OPTIONS), eol);
}

function renderPair(key: string, value: unknown, eol: string): string {
	return withEol(stringify({ [key]: value }, RENDER_OPTIONS), eol);
}

function isInlineValue(value: unknown): boolean {
	return (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	);
}

/** Renders a scalar on one line, keeping the old quote style for strings. Null if it needs more lines. */
function renderInlineScalar(
	value: unknown,
	oldType: Scalar["type"],
	inFlow: boolean,
): string | null {
	const scalar = new Scalar(value);
	if (
		typeof value === "string" &&
		(oldType === Scalar.QUOTE_DOUBLE || oldType === Scalar.QUOTE_SINGLE)
	) {
		scalar.type = oldType;
	} else if (typeof value === "string" && inFlow && /[,[\]{}]/.test(value)) {
		// `stringify` renders for block context, where these characters are fine unquoted.
		scalar.type = Scalar.QUOTE_DOUBLE;
	}
	const text = stringify(scalar, RENDER_OPTIONS).replace(/\r?\n$/, "");
	return text.includes("\n") ? null : text;
}

/**
 * Replaces a one-line scalar node in place, so its trailing comment and quote
 * style survive. Returns null when the old node or the new value isn't a simple
 * one-line scalar (block scalars, anchors, tags, lists, maps).
 */
function replaceScalar(
	src: string,
	old: unknown,
	value: unknown,
	inFlow: boolean,
): string | null {
	if (
		!isScalar(old) ||
		!old.range ||
		!isInlineValue(value) ||
		old.type === Scalar.BLOCK_LITERAL ||
		old.type === Scalar.BLOCK_FOLDED ||
		old.anchor !== undefined ||
		old.tag !== undefined
	) {
		return null;
	}
	const text = renderInlineScalar(value, old.type, inFlow);
	if (text === null) return null;
	const [start, end] = old.range;
	// `key:` with no value has an empty range; keep a space after the colon.
	return start === end
		? splice(src, start, end, ` ${text}`)
		: splice(src, start, end, text);
}

// --- layout of collections ------------------------------------------------

interface ItemSpan {
	/** Start of the item: its leading comment lines, or else the line with its `-`. */
	readonly start: number;
	/** Start of the line with the item's `-`. */
	readonly dash: number;
	readonly contentEnd: number;
}

interface SeqLayout {
	readonly col: number;
	readonly spans: readonly ItemSpan[];
	/** True when items are separated by blank lines. */
	readonly separated: boolean;
}

function seqLayout(src: string, seq: YAMLSeq): Result<SeqLayout, EditError> {
	if (seq.flow || !seq.range) {
		return err(
			editError(
				"unsupported-structure",
				"Flow-style lists ([...]) can't be edited structurally",
			),
		);
	}
	const firstDash = seq.range[0];
	const col = firstDash - lineStart(src, firstDash);
	if (!isBlank(src.slice(lineStart(src, firstDash), firstDash))) {
		return err(
			editError(
				"unsupported-structure",
				"Compact nested lists (- - item) are not supported",
			),
		);
	}
	const spans: ItemSpan[] = [];
	for (const item of seq.items) {
		const itemStart = isNode(item) ? item.range?.[0] : undefined;
		if (itemStart === undefined) {
			return err(
				editError(
					"unsupported-structure",
					"List item without a source position",
				),
			);
		}
		let dashLine = lineStart(src, itemStart);
		// Walk up to the line that holds this item's dash (props like &anchor may sit there).
		while (true) {
			const line = lineText(src, dashLine);
			if (indentOf(line) === col && line[col] === "-") break;
			if (dashLine === 0) {
				return err(
					editError(
						"unsupported-structure",
						"Could not find the list item's dash",
					),
				);
			}
			dashLine = lineStart(src, dashLine - 1);
		}
		// Comment lines right above the dash, at the same indent, describe this item and move with it.
		let start = dashLine;
		while (start > 0) {
			const previous = lineStart(src, start - 1);
			const line = lineText(src, previous);
			if (indentOf(line) !== col || !line.trimStart().startsWith("#")) break;
			start = previous;
		}
		spans.push({
			start,
			dash: dashLine,
			contentEnd: blockContentEnd(src, dashLine, col),
		});
	}
	const [first, second] = spans;
	const separated =
		first !== undefined &&
		second !== undefined &&
		hasBlankLine(src.slice(first.contentEnd, second.start));
	return ok({ col, spans, separated });
}

interface PairSpan {
	readonly key: string;
	/** Line start, or the key itself when the key shares the line with a `-`. */
	readonly start: number;
	readonly keyStart: number;
	readonly contentEnd: number;
	readonly onDashLine: boolean;
	readonly value: unknown;
}

interface MapLayout {
	readonly col: number;
	readonly pairs: readonly PairSpan[];
}

function mapLayout(src: string, map: YAMLMap): Result<MapLayout, EditError> {
	if (map.flow) {
		return err(
			editError(
				"unsupported-structure",
				"Flow-style maps ({...}) can't be edited",
			),
		);
	}
	const pairs: PairSpan[] = [];
	let col = -1;
	for (const pair of map.items) {
		if (!isScalar(pair.key) || !pair.key.range) {
			return err(
				editError("unsupported-structure", "Only plain keys are supported"),
			);
		}
		const keyStart = pair.key.range[0];
		const ls = lineStart(src, keyStart);
		if (col === -1) col = keyStart - ls;
		const onDashLine = !isBlank(src.slice(ls, keyStart));
		pairs.push({
			key: String(pair.key.value),
			start: onDashLine ? keyStart : ls,
			keyStart,
			contentEnd: blockContentEnd(src, ls, col),
			onDashLine,
			value: pair.value,
		});
	}
	if (pairs.length === 0) {
		return err(
			editError("unsupported-structure", "Empty maps can't be edited"),
		);
	}
	return ok({ col, pairs });
}

function getBlockMap(
	yaml: ParsedYaml,
	path: YamlPath,
): Result<YAMLMap, EditError> {
	const node = getNodeAt(yaml, path);
	if (isMap(node)) return ok(node);
	if (isAlias(node)) {
		return err(
			editError(
				"widget-is-alias",
				"This item is an alias (*name); edit the anchored item instead",
			),
		);
	}
	return err(editError("not-found", `No map at ${JSON.stringify(path)}`));
}

/** Replaces an existing pair, or appends it to the end of the map. */
function writePairText(
	src: string,
	map: YAMLMap,
	key: string,
	pairText: string,
): Result<string, EditError> {
	const layout = mapLayout(src, map);
	if (!layout.ok) return layout;
	const { col, pairs } = layout.value;
	const existing = pairs.find((pair) => pair.key === key);
	if (existing) {
		return ok(
			splice(
				src,
				existing.start,
				existing.contentEnd,
				indent(pairText, col, existing.onDashLine),
			),
		);
	}
	const last = pairs[pairs.length - 1];
	if (!last)
		return err(
			editError("unsupported-structure", "Empty maps can't be edited"),
		);
	const prefix =
		last.contentEnd === src.length && !src.endsWith("\n") ? detectEol(src) : "";
	return ok(
		splice(
			src,
			last.contentEnd,
			last.contentEnd,
			prefix + indent(pairText, col),
		),
	);
}

// --- public edit primitives -----------------------------------------------

/**
 * Sets `key` to `value` in the map at `mapPath`. A single-line scalar is
 * replaced in place (trailing comments and quote style survive), also inside a
 * flow map (`{ a: 1 }`); anything else replaces the whole `key: value` block.
 * A missing key is appended at the end.
 * @param src - Current source.
 * @param yaml - `src`, parsed.
 * @param mapPath - Path of the map.
 * @param key - Key to set.
 * @param value - Plain JS value.
 * @returns The new source.
 */
export function setMapEntry(
	src: string,
	yaml: ParsedYaml,
	mapPath: YamlPath,
	key: string,
	value: unknown,
): Result<string, EditError> {
	const map = getBlockMap(yaml, mapPath);
	if (!map.ok) return map;
	const existing = map.value.items.find(
		(pair) => isScalar(pair.key) && String(pair.key.value) === key,
	);
	const inPlace = replaceScalar(
		src,
		existing?.value,
		value,
		map.value.flow === true,
	);
	if (inPlace !== null) return ok(inPlace);
	return writePairText(
		src,
		map.value,
		key,
		renderPair(key, value, detectEol(src)),
	);
}

/**
 * Removes `key` (and its value block) from the map at `mapPath`.
 * Comment lines above the key are kept.
 * @param src - Current source.
 * @param yaml - `src`, parsed.
 * @param mapPath - Path of the map.
 * @param key - Key to remove.
 * @returns The new source.
 */
export function removeMapEntry(
	src: string,
	yaml: ParsedYaml,
	mapPath: YamlPath,
	key: string,
): Result<string, EditError> {
	const map = getBlockMap(yaml, mapPath);
	if (!map.ok) return map;
	const layout = mapLayout(src, map.value);
	if (!layout.ok) return layout;
	const { pairs } = layout.value;
	const index = pairs.findIndex((pair) => pair.key === key);
	const pair = pairs[index];
	if (!pair)
		return err(editError("option-not-found", `Key "${key}" is not set here`));
	if (pair.onDashLine) {
		// The key shares its line with `-`: pull the next key up onto that line.
		const next = pairs[index + 1];
		if (!next)
			return err(
				editError(
					"unsupported-structure",
					"Can't remove the only key of a list item",
				),
			);
		return ok(splice(src, pair.keyStart, next.keyStart, ""));
	}
	return ok(splice(src, pair.start, pair.contentEnd, ""));
}

/**
 * Inserts a rendered item (column-0 text starting with `- `) into the list at
 * `seqPath`, re-indented to match its siblings. Creates the list when it is
 * missing or empty (`key:`, `key: []`).
 * @param src - Current source.
 * @param yaml - `src`, parsed.
 * @param seqPath - Path of the list; its last element is the key in the parent map.
 * @param index - Position of the new item.
 * @param itemText - The item, e.g. from `renderItem`.
 * @param separatedHint - Whether to put a blank line between items when the
 *   list has fewer than two items, so its own style can't be detected.
 * @returns The new source.
 */
export function insertSeqItem(
	src: string,
	yaml: ParsedYaml,
	seqPath: YamlPath,
	index: number,
	itemText: string,
	separatedHint = false,
): Result<string, EditError> {
	const eol = detectEol(src);
	const item = ensureTrailingEol(withEol(itemText, eol), eol);
	const node = getNodeAt(yaml, seqPath);
	if (isSeq(node) && node.items.length > 0) {
		const layout = seqLayout(src, node);
		if (!layout.ok) return layout;
		const { col, spans, separated } = layout.value;
		if (!Number.isInteger(index) || index < 0 || index > spans.length) {
			return err(
				editError(
					"index-out-of-range",
					`Index ${index} is outside 0..${spans.length}`,
				),
			);
		}
		const gap = (spans.length < 2 ? separatedHint : separated) ? eol : "";
		const before = spans[index];
		if (before) {
			return ok(
				splice(src, before.start, before.start, indent(item, col) + gap),
			);
		}
		const last = spans[spans.length - 1];
		if (!last)
			return err(editError("unsupported-structure", "List has no items"));
		const prefix =
			last.contentEnd === src.length && !src.endsWith("\n") ? eol : "";
		return ok(
			splice(
				src,
				last.contentEnd,
				last.contentEnd,
				prefix + gap + indent(item, col),
			),
		);
	}
	const isEmpty =
		node === undefined ||
		(isSeq(node) && node.items.length === 0) ||
		(isScalar(node) && node.value === null);
	if (!isEmpty)
		return err(
			editError(
				"unsupported-structure",
				`${JSON.stringify(seqPath)} is not a list`,
			),
		);
	if (index !== 0)
		return err(
			editError("index-out-of-range", `Index ${index} is outside 0..0`),
		);
	const key = seqPath[seqPath.length - 1];
	if (typeof key !== "string")
		return err(editError("invalid-path", "A list path must end with a key"));
	const parent = getBlockMap(yaml, seqPath.slice(0, -1));
	if (!parent.ok) return parent;
	return writePairText(
		src,
		parent.value,
		key,
		`${key}:${eol}${indent(item, 2)}`,
	);
}

/**
 * Replaces item `index` of the list at `seqPath`. A single-line scalar is
 * replaced in place (also in a flow list); anything else replaces the item's
 * block, while the comment lines above it stay.
 * @param src - Current source.
 * @param yaml - `src`, parsed.
 * @param seqPath - Path of the list.
 * @param index - Item to replace.
 * @param value - Plain JS value.
 * @returns The new source.
 */
export function setSeqItem(
	src: string,
	yaml: ParsedYaml,
	seqPath: YamlPath,
	index: number,
	value: unknown,
): Result<string, EditError> {
	const node = getNodeAt(yaml, seqPath);
	if (!isSeq(node))
		return err(editError("not-found", `No list at ${JSON.stringify(seqPath)}`));
	if (!Number.isInteger(index) || index < 0 || index >= node.items.length) {
		return err(
			editError(
				"index-out-of-range",
				`No item ${index} in ${JSON.stringify(seqPath)}`,
			),
		);
	}
	const inPlace = replaceScalar(
		src,
		node.items[index],
		value,
		node.flow === true,
	);
	if (inPlace !== null) return ok(inPlace);
	const layout = seqLayout(src, node);
	if (!layout.ok) return layout;
	const { col, spans } = layout.value;
	const span = spans[index];
	if (!span)
		return err(editError("index-out-of-range", `No item ${index} in the list`));
	const eol = detectEol(src);
	let text = indent(ensureTrailingEol(renderItem(value, eol), eol), col);
	// Don't add a line break at the end of a file that had none.
	if (span.contentEnd === src.length && !src.endsWith("\n")) {
		text = text.replace(/\r?\n$/, "");
	}
	return ok(splice(src, span.dash, span.contentEnd, text));
}

/**
 * Tells whether a block list separates its items with blank lines (judged
 * from its first two items).
 * @param src - Current source.
 * @param yaml - `src`, parsed.
 * @param seqPath - Path of the list.
 * @returns True for a list like `- a

- b`; false otherwise or when unknown.
 */
export function isSeparatedList(
	src: string,
	yaml: ParsedYaml,
	seqPath: YamlPath,
): boolean {
	const node = getNodeAt(yaml, seqPath);
	if (!isSeq(node) || node.items.length < 2) return false;
	const layout = seqLayout(src, node);
	return layout.ok && layout.value.separated;
}

/**
 * Returns the source text of one list item (with its leading comment lines),
 * shifted to column 0 so it starts with `- `.
 * @param src - Current source.
 * @param yaml - `src`, parsed.
 * @param seqPath - Path of the list.
 * @param index - Item to read.
 * @returns The item text, or `null` when the item doesn't exist or the list is flow style.
 */
export function readSeqItem(
	src: string,
	yaml: ParsedYaml,
	seqPath: YamlPath,
	index: number,
): string | null {
	const node = getNodeAt(yaml, seqPath);
	if (!isSeq(node)) return null;
	const layout = seqLayout(src, node);
	if (!layout.ok) return null;
	const span = layout.value.spans[index];
	if (!span) return null;
	return dedent(src.slice(span.start, span.contentEnd), layout.value.col);
}

/**
 * Removes item `index` from the list at `seqPath`, together with the blank
 * lines that separated it from its neighbours and the comment lines directly
 * above it (they describe the item).
 * @param src - Current source.
 * @param yaml - `src`, parsed.
 * @param seqPath - Path of the list.
 * @param index - Item to remove.
 * @returns The new source, the removed item as column-0 text, and whether
 *   the list separated its items with blank lines.
 */
export function removeSeqItem(
	src: string,
	yaml: ParsedYaml,
	seqPath: YamlPath,
	index: number,
): Result<{ source: string; removed: string; separated: boolean }, EditError> {
	const node = getNodeAt(yaml, seqPath);
	if (!isSeq(node))
		return err(editError("not-found", `No list at ${JSON.stringify(seqPath)}`));
	const layout = seqLayout(src, node);
	if (!layout.ok) return layout;
	const { col, spans, separated } = layout.value;
	const span = spans[index];
	if (!span)
		return err(
			editError(
				"index-out-of-range",
				`No item ${index} in ${JSON.stringify(seqPath)}`,
			),
		);
	let from = span.start;
	let to = span.contentEnd;
	const removed = dedent(src.slice(from, to), col);
	if (index < spans.length - 1) {
		while (to < src.length && isBlank(lineText(src, to))) to = lineEnd(src, to);
	} else if (spans.length > 1) {
		while (from > 0 && isBlank(lineText(src, lineStart(src, from - 1)))) {
			from = lineStart(src, from - 1);
		}
	}
	return ok({ source: splice(src, from, to, ""), removed, separated });
}
