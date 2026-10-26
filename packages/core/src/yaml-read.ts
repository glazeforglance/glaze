import {
	type Document,
	isAlias,
	isMap,
	isScalar,
	isSeq,
	parseDocument,
	type YAMLMap,
} from "yaml";
import type { YamlPath } from "./types.ts";

/** A parsed YAML document as produced by `parseYamlDocument`. */
export type ParsedYaml = Document.Parsed;

/**
 * Parses YAML text with the options Glaze uses everywhere.
 * `merge: true` makes `<<: *anchor` behave like Glance (yaml.v3) does.
 * @param text - YAML source.
 * @returns The parsed document, which may contain errors in `doc.errors`.
 */
export function parseYamlDocument(text: string): ParsedYaml {
	return parseDocument(text, { merge: true });
}

/**
 * Follows an alias (`*name`) to the node it points to.
 * @param doc - The document that owns the node.
 * @param node - Any node or value.
 * @returns The anchored node for aliases, otherwise `node` itself.
 */
export function resolveNode(doc: ParsedYaml, node: unknown): unknown {
	// Aliases can't point to aliases, so one step is enough.
	return isAlias(node) ? node.resolve(doc) : node;
}

/**
 * Returns the node at `path`, without following aliases.
 * @param doc - The document to read.
 * @param path - Path from the document root.
 * @returns The node, or `undefined` when nothing is there.
 */
export function getNodeAt(doc: ParsedYaml, path: YamlPath): unknown {
	return path.length === 0 ? doc.contents : doc.getIn(path, true);
}

/**
 * Returns the plain value of a map key.
 * @param key - A pair's key (a node or a plain value).
 * @returns The scalar's value, or `key` itself when it isn't a scalar.
 */
export function pairKey(key: unknown): unknown {
	return isScalar(key) ? key.value : key;
}

/**
 * Tells whether a map key is the merge key `<<`.
 * @param key - A pair's key.
 * @returns True for `<<`.
 */
export function isMergeKey(key: unknown): boolean {
	return isScalar(key) && (key.value === "<<" || key.source === "<<");
}

/**
 * Finds the value node for `key` in a map, looking through merge keys
 * (`<<: *anchor` or `<<: [*a, *b]`) when the map doesn't set it itself.
 * @param doc - The document that owns the map.
 * @param map - The map to read.
 * @param key - The key to look up.
 * @returns The value node, or `undefined` when the key is not set.
 */
export function getMapValue(
	doc: ParsedYaml,
	map: YAMLMap,
	key: string,
): unknown {
	for (const pair of map.items) {
		if (pairKey(pair.key) === key) return pair.value;
	}
	for (const pair of map.items) {
		if (!isMergeKey(pair.key)) continue;
		const merged = resolveNode(doc, pair.value);
		const sources = isSeq(merged) ? merged.items : [merged];
		for (const source of sources) {
			const resolved = resolveNode(doc, source);
			if (!isMap(resolved)) continue;
			const value = getMapValue(doc, resolved, key);
			if (value !== undefined) return value;
		}
	}
	return undefined;
}

/**
 * Reads a scalar value as a string (numbers and booleans are converted).
 * @param doc - The document that owns the map.
 * @param map - The map to read.
 * @param key - The key to look up, merge keys included.
 * @returns The string value, or `null` when missing or not a scalar.
 */
export function readString(
	doc: ParsedYaml,
	map: YAMLMap,
	key: string,
): string | null {
	const node = resolveNode(doc, getMapValue(doc, map, key));
	if (!isScalar(node) || node.value === null || node.value === undefined) {
		return null;
	}
	return String(node.value);
}

/**
 * Detects Glance include items: `- $include: file.yml` or `- !include: file.yml`.
 * Glance resolves these before parsing YAML, so Glaze treats them as opaque.
 * @param node - A sequence item.
 * @returns The included file path, or `null` when the item is not an include.
 */
export function readInclude(node: unknown): string | null {
	if (isScalar(node) && node.tag?.startsWith("!include")) {
		return String(node.value);
	}
	if (isMap(node) && node.items.length === 1) {
		const [pair] = node.items;
		if (pair && pairKey(pair.key) === "$include" && isScalar(pair.value)) {
			return String(pair.value.value);
		}
	}
	return null;
}
