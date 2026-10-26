import { isAlias, visit } from "yaml";
import { assignIds } from "./ids.ts";
import { offsetToLineColumn } from "./ranges.ts";
import { err, ok, type Result } from "./result.ts";
import type { ParseError } from "./types.ts";
import { type ParsedYaml, parseYamlDocument } from "./yaml-read.ts";

/**
 * A loaded `glance.yml`. Immutable: every edit returns a new document.
 * `source` is the exact text; it is the single source of truth for serializing.
 */
export interface GlazeDocument {
	readonly source: string;
	/** Parsed view of `source`, for reading only. Never mutate it. */
	readonly yaml: ParsedYaml;
	/** Glaze ids keyed by `pathKey(path)`. */
	readonly ids: ReadonlyMap<string, string>;
	readonly nextId: number;
}

/**
 * Parses and checks YAML text without assigning ids.
 * @param text - YAML source.
 * @returns The parsed document, or the first problem found.
 */
export function parseChecked(text: string): Result<ParsedYaml, ParseError> {
	const yaml = parseYamlDocument(text);
	const [first] = yaml.errors;
	if (first) {
		const pos = first.linePos?.[0];
		const at = pos
			? { line: pos.line, column: pos.col }
			: offsetToLineColumn(text, first.pos[0]);
		return err({
			code: "yaml-syntax",
			// The yaml package appends "at line N, column M:" and a code excerpt;
			// line and column are separate fields, and the excerpt is the editor's job.
			message: (first.message.split("\n")[0] ?? first.message).replace(
				/ at line \d+, column \d+:?$/,
				"",
			),
			line: at.line,
			column: at.column,
		});
	}
	// The yaml package only notices missing anchors when converting to JS; check up front.
	const unresolved: { source: string; offset: number }[] = [];
	visit(yaml, {
		Alias(_, node) {
			if (isAlias(node) && node.resolve(yaml) === undefined) {
				unresolved.push({ source: node.source, offset: node.range?.[0] ?? 0 });
				return visit.BREAK;
			}
			return undefined;
		},
	});
	const [missing] = unresolved;
	if (missing) {
		const { source, offset } = missing;
		const at = offsetToLineColumn(text, offset);
		return err({
			code: "unresolved-alias",
			message: `Alias *${source} has no matching anchor &${source}`,
			line: at.line,
			column: at.column,
		});
	}
	return ok(yaml);
}

/**
 * Reads a `glance.yml`.
 * @param text - The file contents.
 * @returns A `GlazeDocument`, or a `ParseError` for invalid YAML.
 */
export function parseConfig(text: string): Result<GlazeDocument, ParseError> {
	const parsed = parseChecked(text);
	if (!parsed.ok) return parsed;
	const { ids, nextId } = assignIds(parsed.value, {
		ids: new Map(),
		nextId: 1,
	});
	return ok({ source: text, yaml: parsed.value, ids, nextId });
}

/**
 * Replaces a document's text with new text typed by hand (the code view).
 * Pages, columns and widgets keep their ids when their path still exists, so
 * the selection and open forms survive; new paths get new ids.
 * @param previous - The current document.
 * @param text - The new YAML text.
 * @returns The new document, or a `ParseError` for invalid YAML.
 */
export function replaceSource(
	previous: GlazeDocument,
	text: string,
): Result<GlazeDocument, ParseError> {
	if (text === previous.source) return ok(previous);
	const parsed = parseChecked(text);
	if (!parsed.ok) return parsed;
	const { ids, nextId } = assignIds(parsed.value, previous);
	return ok({ source: text, yaml: parsed.value, ids, nextId });
}

/**
 * Writes a document back to YAML text.
 * Because edits patch the text directly, this is the stored source, byte for byte.
 * @param doc - The document to serialize.
 * @returns The YAML text.
 */
export function serializeConfig(doc: GlazeDocument): string {
	return doc.source;
}
