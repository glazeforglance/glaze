import { listNodePaths, pathKey } from "./model.ts";
import type { YamlPath } from "./types.ts";
import type { ParsedYaml } from "./yaml-read.ts";

/** A structural change to a sequence, used to carry ids along with their nodes. */
export type PathChange =
	| { readonly kind: "insert"; readonly seq: YamlPath; readonly index: number }
	| { readonly kind: "remove"; readonly seq: YamlPath; readonly index: number }
	| {
			readonly kind: "move";
			readonly fromSeq: YamlPath;
			readonly fromIndex: number;
			/** Target list, as a path in the document after the item was removed. */
			readonly toSeq: YamlPath;
			readonly toIndex: number;
	  };

/** Ids keyed by `pathKey(path)`, plus the counter for new ones. */
export interface IdTable {
	readonly ids: ReadonlyMap<string, string>;
	readonly nextId: number;
}

/**
 * Tells whether `prefix` is the start of `path`.
 * @param path - The full path.
 * @param prefix - The candidate prefix.
 * @returns True when every element of `prefix` matches `path`.
 */
export function startsWith(path: YamlPath, prefix: YamlPath): boolean {
	return (
		path.length >= prefix.length && prefix.every((part, i) => path[i] === part)
	);
}

/** Adds `delta` to the index right after `seq` in every path whose index is >= `from`. */
function shift(
	entries: [YamlPath, string][],
	seq: YamlPath,
	from: number,
	delta: number,
): [YamlPath, string][] {
	const depth = seq.length;
	return entries.map(([path, id]) => {
		const index = path[depth];
		if (!startsWith(path, seq) || typeof index !== "number" || index < from) {
			return [path, id];
		}
		return [[...seq, index + delta, ...path.slice(depth + 1)], id];
	});
}

function removeSubtree(
	entries: [YamlPath, string][],
	item: YamlPath,
): { kept: [YamlPath, string][]; removed: [YamlPath, string][] } {
	const kept: [YamlPath, string][] = [];
	const removed: [YamlPath, string][] = [];
	for (const entry of entries) {
		(startsWith(entry[0], item) ? removed : kept).push(entry);
	}
	return { kept, removed };
}

/**
 * Rewrites id paths so ids follow their nodes through a structural change.
 * @param ids - Ids keyed by path, before the change.
 * @param change - What happened to the sequence.
 * @returns Ids keyed by path, after the change.
 */
export function applyPathChange(
	ids: ReadonlyMap<string, string>,
	change: PathChange,
): Map<string, string> {
	let entries: [YamlPath, string][] = [...ids].map(([key, id]) => [
		JSON.parse(key) as YamlPath,
		id,
	]);
	if (change.kind === "insert") {
		entries = shift(entries, change.seq, change.index, 1);
	} else if (change.kind === "remove") {
		const { kept } = removeSubtree(entries, [...change.seq, change.index]);
		entries = shift(kept, change.seq, change.index + 1, -1);
	} else {
		const fromItem = [...change.fromSeq, change.fromIndex];
		const { kept, removed } = removeSubtree(entries, fromItem);
		entries = shift(kept, change.fromSeq, change.fromIndex + 1, -1);
		entries = shift(entries, change.toSeq, change.toIndex, 1);
		const toItem = [...change.toSeq, change.toIndex];
		for (const [path, id] of removed) {
			entries.push([[...toItem, ...path.slice(fromItem.length)], id]);
		}
	}
	return new Map(entries.map(([path, id]) => [pathKey(path), id]));
}

/**
 * Makes sure every page, column and widget has an id: keeps known ones,
 * creates new ones (`page-1`, `widget-7`, ...) and drops ids of vanished paths.
 * @param yaml - The parsed document.
 * @param previous - Ids carried over from the previous version.
 * @returns The complete id table for `yaml`.
 */
export function assignIds(yaml: ParsedYaml, previous: IdTable): IdTable {
	const ids = new Map<string, string>();
	let nextId = previous.nextId;
	for (const { path, kind } of listNodePaths(yaml)) {
		const key = pathKey(path);
		const known = previous.ids.get(key);
		if (known !== undefined) {
			ids.set(key, known);
		} else {
			ids.set(key, `${kind}-${nextId}`);
			nextId += 1;
		}
	}
	return { ids, nextId };
}
