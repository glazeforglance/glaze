import { isSeq } from "yaml";
import type { GlazeDocument } from "./document.ts";
import { finishEdit, moveItem, splitItemPath } from "./edit.ts";
import { err, type Result } from "./result.ts";
import {
	editError,
	insertSeqItem,
	removeSeqItem,
	renderItem,
	setMapEntry,
} from "./text-edit.ts";
import type { EditError, YamlPath } from "./types.ts";
import { getNodeAt } from "./yaml-read.ts";

const PAGES: YamlPath = ["pages"];

function pageCount(doc: GlazeDocument): number {
	const pages = getNodeAt(doc.yaml, PAGES);
	return isSeq(pages) ? pages.items.length : 0;
}

function eolOf(doc: GlazeDocument): string {
	return doc.source.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * Adds a page with one empty `full` column (the smallest valid layout).
 * @param doc - The document to edit.
 * @param name - Page name shown in Glance's navigation.
 * @param index - Position among the pages; defaults to the end.
 * @returns The new document, or why the page couldn't be added.
 */
export function addPage(
	doc: GlazeDocument,
	name: string,
	index?: number,
): Result<GlazeDocument, EditError> {
	const at = index ?? pageCount(doc);
	const item = renderItem({ name, columns: [{ size: "full" }] }, eolOf(doc));
	const source = insertSeqItem(doc.source, doc.yaml, PAGES, at, item);
	if (!source.ok) return source;
	return finishEdit(doc, source.value, {
		kind: "insert",
		seq: PAGES,
		index: at,
	});
}

/**
 * Changes a page's `name`.
 * @param doc - The document to edit.
 * @param pagePath - Path of the page, e.g. `["pages", 0]`.
 * @param name - The new name.
 * @returns The new document, or why the page couldn't be renamed.
 */
export function renamePage(
	doc: GlazeDocument,
	pagePath: YamlPath,
	name: string,
): Result<GlazeDocument, EditError> {
	const item = splitItemPath(pagePath, ["pages"]);
	if (!item.ok) return item;
	const source = setMapEntry(doc.source, doc.yaml, pagePath, "name", name);
	if (!source.ok) return source;
	return finishEdit(doc, source.value, null);
}

/**
 * Removes a page. Refused when it is the last page (Glance needs at least one).
 * @param doc - The document to edit.
 * @param pagePath - Path of the page.
 * @returns The new document, or why the page couldn't be removed.
 */
export function removePage(
	doc: GlazeDocument,
	pagePath: YamlPath,
): Result<GlazeDocument, EditError> {
	const item = splitItemPath(pagePath, ["pages"]);
	if (!item.ok) return item;
	const removed = removeSeqItem(doc.source, doc.yaml, PAGES, item.value.index);
	if (!removed.ok) return removed;
	return finishEdit(doc, removed.value.source, {
		kind: "remove",
		seq: PAGES,
		index: item.value.index,
	});
}

/**
 * Moves a page to another position.
 * @param doc - The document to edit.
 * @param pagePath - Path of the page.
 * @param toIndex - New position, counted without the moved page.
 * @returns The new document, or why the page couldn't be moved.
 */
export function movePage(
	doc: GlazeDocument,
	pagePath: YamlPath,
	toIndex: number,
): Result<GlazeDocument, EditError> {
	const item = splitItemPath(pagePath, ["pages"]);
	if (!item.ok) return item;
	if (toIndex < 0 || toIndex >= pageCount(doc)) {
		return err(
			editError(
				"index-out-of-range",
				`Index ${toIndex} is outside the page list`,
			),
		);
	}
	return moveItem(doc, PAGES, item.value.index, PAGES, toIndex);
}

// Glance's own rule (titleToSlug in utils.go): lower case, runs of white
// space become "-", and dashes at either end are dropped.
const WHITESPACE = /\s+/g;

/** Slugs Glance reserves for its own pages (glance.go). */
export const RESERVED_SLUGS: readonly string[] = ["login", "logout"];

/**
 * The slug Glance makes from a page name when `slug` isn't set.
 * @param name - The page name.
 * @returns The slug, e.g. "My Home" → "my-home".
 */
export function slugFromName(name: string): string {
	return name
		.toLowerCase()
		.replace(WHITESPACE, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Explains why a page's slug (written, or made from its name) won't work.
 * @param pages - Every page's name and slug, in order.
 * @param index - The page to check.
 * @returns A sentence for the user, or `null` when the slug is fine.
 */
export function slugProblem(
	pages: readonly {
		readonly name: string | null;
		readonly slug: string | null;
	}[],
	index: number,
): string | null {
	const slugOf = (page: { name: string | null; slug: string | null }) =>
		page.slug !== null && page.slug !== ""
			? page.slug
			: slugFromName(page.name ?? "");
	const page = pages[index];
	if (!page) return null;
	const slug = slugOf(page);
	if (RESERVED_SLUGS.includes(slug)) {
		return `"${slug}" is reserved by Glance; pick another URL path.`;
	}
	const other = pages.findIndex(
		(candidate, i) => i !== index && slugOf(candidate) === slug,
	);
	if (other !== -1) {
		return `Page ${other + 1} already uses the URL path "${slug}"; Glance would only show one of them.`;
	}
	return null;
}
