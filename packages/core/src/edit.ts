import { type GlazeDocument, parseChecked } from "./document.ts";
import {
	applyPathChange,
	assignIds,
	type PathChange,
	startsWith,
} from "./ids.ts";
import { glazeLayoutIssues, validateYamlLayout } from "./layout.ts";
import { pathKey } from "./model.ts";
import { err, ok, type Result } from "./result.ts";
import type { EditError, LayoutIssue, YamlPath } from "./types.ts";
import { editError, insertSeqItem, removeSeqItem } from "./text-edit.ts";
import { parseYamlDocument } from "./yaml-read.ts";

function countByCode(issues: readonly LayoutIssue[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const issue of issues)
		counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
	return counts;
}

/**
 * Turns edited source into the next `GlazeDocument`, or refuses the edit.
 * The edit is refused when the text no longer parses, or when it adds layout
 * issues (Glance's rules or Glaze's editing rules): a document that already
 * had issues can still be edited elsewhere.
 * @param previous - Document before the edit.
 * @param source - Edited source text.
 * @param change - Structural change(s), so ids can follow their nodes.
 * @returns The new document, or why the edit was refused.
 */
export function finishEdit(
	previous: GlazeDocument,
	source: string,
	change: PathChange | readonly PathChange[] | null,
): Result<GlazeDocument, EditError> {
	const parsed = parseChecked(source);
	if (!parsed.ok) {
		return err(
			editError(
				"invalid-result",
				`The edit would break the YAML: ${parsed.error.message}`,
				[],
				// A missing anchor is ours to explain; a syntax error is the yaml package's.
				parsed.error.code === "unresolved-alias" && parsed.error.params
					? parsed.error.params
					: { detail: parsed.error.message },
			),
		);
	}
	const before = countByCode([
		...validateYamlLayout(previous.yaml),
		...glazeLayoutIssues(previous.yaml),
	]);
	const afterIssues = [
		...validateYamlLayout(parsed.value),
		...glazeLayoutIssues(parsed.value),
	];
	const after = countByCode(afterIssues);
	const added = afterIssues.filter(
		(issue) => (after.get(issue.code) ?? 0) > (before.get(issue.code) ?? 0),
	);
	if (added.length > 0) {
		const [first] = added;
		return err(
			editError("layout-violation", first?.message ?? "Invalid layout", added),
		);
	}
	const ids = change ? applyPathChange(previous.ids, change) : previous.ids;
	const table = assignIds(parsed.value, { ids, nextId: previous.nextId });
	return ok({
		source,
		yaml: parsed.value,
		ids: table.ids,
		nextId: table.nextId,
	});
}

/**
 * Splits an item path like `["pages", 0, "columns", 2]` into list path and index,
 * checking that the list key is one of `listKeys`.
 * @param path - Path of a list item.
 * @param listKeys - Allowed keys for the list that holds the item.
 * @returns The list path and the index.
 */
export function splitItemPath(
	path: YamlPath,
	listKeys: readonly string[],
): Result<{ seq: YamlPath; index: number }, EditError> {
	const index = path[path.length - 1];
	const key = path[path.length - 2];
	if (
		typeof index !== "number" ||
		typeof key !== "string" ||
		!listKeys.includes(key)
	) {
		return err(
			editError(
				"invalid-path",
				`${JSON.stringify(path)} is not a ${listKeys.join("/")} item`,
			),
		);
	}
	return ok({ seq: path.slice(0, -1), index });
}

/**
 * Checks that `path` points at a list with one of the given keys.
 * @param path - Path of a list, e.g. `["pages", 0, "columns"]`.
 * @param listKeys - Allowed last keys.
 * @returns `path`, or an `invalid-path` error.
 */
export function checkListPath(
	path: YamlPath,
	listKeys: readonly string[],
): Result<YamlPath, EditError> {
	const key = path[path.length - 1];
	if (typeof key !== "string" || !listKeys.includes(key)) {
		return err(
			editError(
				"invalid-path",
				`${JSON.stringify(path)} is not a ${listKeys.join("/")} list`,
			),
		);
	}
	return ok(path);
}

/**
 * Moves a list item to another position or another list, keeping its text
 * (comments included) and re-indenting it for the target list.
 * @param doc - Document before the move.
 * @param fromSeq - List that holds the item.
 * @param fromIndex - Index of the item.
 * @param toSeq - Target list, as a path in `doc` (before the move).
 * @param toIndex - Index in the target list after the item was taken out.
 * @returns The new document, or why the move was refused.
 */
export function moveItem(
	doc: GlazeDocument,
	fromSeq: YamlPath,
	fromIndex: number,
	toSeq: YamlPath,
	toIndex: number,
): Result<GlazeDocument, EditError> {
	if (startsWith(toSeq, [...fromSeq, fromIndex])) {
		return err(editError("invalid-move", "An item can't be moved into itself"));
	}
	const removed = removeSeqItem(doc.source, doc.yaml, fromSeq, fromIndex);
	if (!removed.ok) return removed;
	// No alias check here: an anchor may be missing only until the item is re-inserted.
	const between = parseYamlDocument(removed.value.source);
	if (between.errors.length > 0) {
		return err(editError("invalid-result", "The move would break the YAML"));
	}
	// Taking the item out shifts later siblings (and their descendants) up by one.
	const depth = fromSeq.length;
	const at = toSeq[depth];
	const target =
		startsWith(toSeq, fromSeq) && typeof at === "number" && at > fromIndex
			? [...fromSeq, at - 1, ...toSeq.slice(depth + 1)]
			: toSeq;
	const sameList = pathKey(target) === pathKey(fromSeq);
	const inserted = insertSeqItem(
		removed.value.source,
		between,
		target,
		toIndex,
		removed.value.removed,
		sameList && removed.value.separated,
	);
	if (!inserted.ok) return inserted;
	return finishEdit(doc, inserted.value, {
		kind: "move",
		fromSeq,
		fromIndex,
		toSeq: target,
		toIndex,
	});
}
