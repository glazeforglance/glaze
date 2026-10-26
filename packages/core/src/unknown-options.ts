import { isMap, isScalar } from "yaml";
import type { GlazeDocument } from "./document.ts";
import { listNodePaths } from "./model.ts";
import type { YamlPath } from "./types.ts";
import {
	getNodeAt,
	isMergeKey,
	pairKey,
	readInclude,
	readString,
} from "./yaml-read.ts";

/**
 * The option names the caller knows about. Core has no schemas of its own,
 * so whoever calls `findUnknownOptions` decides what counts as known.
 */
export interface KnownKeys {
	/** Keys of a page; pages aren't checked when left out. */
	readonly page?: readonly string[];
	/** Keys of a column; columns aren't checked when left out. */
	readonly column?: readonly string[];
	/** Keys every widget has. */
	readonly widgetBase: readonly string[];
	/** Extra keys per widget type. Widgets of other types aren't checked. */
	readonly widgetTypes: Readonly<Record<string, readonly string[]>>;
}

/** An option Glance doesn't know (Glance silently ignores these). */
export interface UnknownOption {
	/** Path of the option itself, e.g. `[..., "widgets", 0, "stlye"]`. */
	readonly path: YamlPath;
	readonly key: string;
	/** The closest known key (edit distance ≤ 2), or `null` when none is close. */
	readonly suggestion: string | null;
}

/**
 * Computes the Levenshtein edit distance between two strings.
 * @param a - First string.
 * @param b - Second string.
 * @returns The number of single-character inserts, deletes or swaps needed.
 */
export function editDistance(a: string, b: string): number {
	let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			current[j] = Math.min(
				(previous[j] ?? 0) + 1,
				(current[j - 1] ?? 0) + 1,
				(previous[j - 1] ?? 0) + cost,
			);
		}
		previous = current;
	}
	return previous[b.length] ?? 0;
}

/**
 * Picks the known key closest to `key`.
 * @param key - The unknown key, e.g. `stlye`.
 * @param known - Candidate keys.
 * @param maxDistance - Largest edit distance that still counts as a typo.
 * @returns The closest key (first one on a tie), or `null` when none is close enough.
 */
export function closestKey(
	key: string,
	known: readonly string[],
	maxDistance = 2,
): string | null {
	let best: string | null = null;
	let bestDistance = maxDistance + 1;
	for (const candidate of known) {
		const distance = editDistance(key, candidate);
		if (distance < bestDistance) {
			best = candidate;
			bestDistance = distance;
		}
	}
	return best;
}

function knownFor(
	kind: "page" | "column" | "widget",
	type: string | null,
	known: KnownKeys,
): readonly string[] | null {
	if (kind === "page") return known.page ?? null;
	if (kind === "column") return known.column ?? null;
	if (type === null || !Object.hasOwn(known.widgetTypes, type)) return null;
	return [...known.widgetBase, ...(known.widgetTypes[type] ?? [])];
}

/**
 * Lists the options of pages, columns and widgets that aren't in `known`.
 * Only keys a node writes itself are checked: merge keys (`<<`), aliases and
 * `$include` items are skipped, and so are widgets of types `known` doesn't list.
 * @param doc - The document to check.
 * @param known - The keys that count as known.
 * @returns Every unknown option, in file order.
 */
export function findUnknownOptions(
	doc: GlazeDocument,
	known: KnownKeys,
): UnknownOption[] {
	const found: UnknownOption[] = [];
	for (const { path, kind } of listNodePaths(doc.yaml)) {
		const node = getNodeAt(doc.yaml, path);
		if (!isMap(node) || readInclude(node) !== null) continue;
		const type = kind === "widget" ? readString(doc.yaml, node, "type") : null;
		const keys = knownFor(kind, type, known);
		if (!keys) continue;
		const present = new Set(node.items.map((pair) => pairKey(pair.key)));
		for (const pair of node.items) {
			const key = pairKey(pair.key);
			if (!isScalar(pair.key) || typeof key !== "string") continue;
			if (isMergeKey(pair.key) || keys.includes(key)) continue;
			const suggestion = closestKey(key, keys);
			found.push({
				path: [...path, key],
				key,
				// Renaming to a key that is already there would create a duplicate.
				suggestion:
					suggestion !== null && !present.has(suggestion) ? suggestion : null,
			});
		}
	}
	return found;
}
