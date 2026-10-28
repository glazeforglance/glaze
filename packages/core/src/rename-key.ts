import { isMap, isScalar } from "yaml";
import type { GlazeDocument } from "./document.ts";
import { finishEdit } from "./edit.ts";
import { err, type Result } from "./result.ts";
import { editError } from "./text-edit.ts";
import type { EditError, YamlPath } from "./types.ts";
import { getNodeAt, pairKey } from "./yaml-read.ts";

// Keys Glance uses never need quotes; anything else is refused rather than escaped.
const PLAIN_KEY = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;

/**
 * Renames one key of a map in place, e.g. a typo `stlye:` → `style:`.
 * Only the key's characters change; its value, comments and position stay.
 * @param doc - The document to edit.
 * @param mapPath - Path of the map that holds the key (a page, column or widget).
 * @param from - The key as it is now.
 * @param to - The new key; must be a plain word like `style` or `check-url`.
 * @returns The new document, or why the key couldn't be renamed.
 */
export function renameKey(
	doc: GlazeDocument,
	mapPath: YamlPath,
	from: string,
	to: string,
): Result<GlazeDocument, EditError> {
	if (!PLAIN_KEY.test(to)) {
		return err(editError("invalid-path", `"${to}" is not a plain key`));
	}
	const map = getNodeAt(doc.yaml, mapPath);
	if (!isMap(map)) {
		return err(editError("not-found", `No map at ${JSON.stringify(mapPath)}`));
	}
	const pair = map.items.find((item) => pairKey(item.key) === from);
	const range = pair && isScalar(pair.key) ? pair.key.range : undefined;
	if (!range) {
		return err(editError("option-not-found", `There is no "${from}" here`));
	}
	if (map.items.some((item) => pairKey(item.key) === to)) {
		return err(
			editError("duplicate-key", `"${to}" is already set here`, [], {
				key: to,
			}),
		);
	}
	const source =
		doc.source.slice(0, range[0]) + to + doc.source.slice(range[1]);
	return finishEdit(doc, source, null);
}
