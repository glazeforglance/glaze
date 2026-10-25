import type { GlazeDocument } from "./document.ts";
import { readSeqItem } from "./text-edit.ts";
import type { YamlPath } from "./types.ts";

/**
 * Returns the original YAML of one page, column or widget, exactly as it is
 * in the file (comments, anchors and templates included), shifted to column 0.
 * @param doc - The document to read.
 * @param path - Path of a list item, e.g. `["pages", 0, "columns", 1, "widgets", 2]`.
 * @returns The item's text starting with `- `, or `null` when the path is not
 *   a list item or can't be located (e.g. inside a flow-style list).
 */
export function getNodeSource(
	doc: GlazeDocument,
	path: YamlPath,
): string | null {
	const index = path[path.length - 1];
	if (typeof index !== "number") return null;
	return readSeqItem(doc.source, doc.yaml, path.slice(0, -1), index);
}
