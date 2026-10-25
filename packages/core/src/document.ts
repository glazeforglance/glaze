import { isAlias, visit } from "yaml";
import { assignIds } from "./ids.ts";
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

function lineOf(text: string, offset: number): number {
	let line = 1;
	for (let i = 0; i < offset && i < text.length; i++) {
		if (text[i] === "\n") line += 1;
	}
	return line;
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
		return err({
			code: "yaml-syntax",
			message: first.message,
			line: first.linePos?.[0].line ?? lineOf(text, first.pos[0]),
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
		return err({
			code: "unresolved-alias",
			message: `Alias *${source} has no matching anchor &${source}`,
			line: lineOf(text, offset),
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
 * Writes a document back to YAML text.
 * Because edits patch the text directly, this is the stored source, byte for byte.
 * @param doc - The document to serialize.
 * @returns The YAML text.
 */
export function serializeConfig(doc: GlazeDocument): string {
	return doc.source;
}
