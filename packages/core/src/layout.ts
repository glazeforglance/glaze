import { isMap, isSeq, type YAMLMap } from "yaml";
import type { GlazeDocument } from "./document.ts";
import type { LayoutIssue, YamlPath } from "./types.ts";
import {
	getMapValue,
	getNodeAt,
	type ParsedYaml,
	readInclude,
	readString,
	resolveNode,
} from "./yaml-read.ts";

const NOT_IN_GROUP = new Set(["group", "split-column"]);

/**
 * Checks the Glance layout rules (from Glance's `config.go`):
 * at least one page; per page 1–3 columns (1–2 when `width: slim`);
 * `size` is `small` or `full`; exactly 1 or 2 `full` columns;
 * no `group` or `split-column` inside a `group`.
 * Items that are `$include`s are skipped, since Glaze can't see their contents.
 * @param doc - The document to check.
 * @returns Every broken rule; empty when the layout is valid.
 */
export function validateLayout(doc: GlazeDocument): LayoutIssue[] {
	return validateYamlLayout(doc.yaml);
}

/**
 * Same as `validateLayout`, for a parsed YAML document.
 * @param yaml - The parsed document.
 * @returns Every broken rule.
 */
export function validateYamlLayout(yaml: ParsedYaml): LayoutIssue[] {
	const issues: LayoutIssue[] = [];
	const pages = resolveNode(yaml, getNodeAt(yaml, ["pages"]));
	if (!isSeq(pages) || pages.items.length === 0) {
		issues.push({
			code: "no-pages",
			message: "The config needs at least one page",
			path: ["pages"],
		});
		return issues;
	}
	pages.items.forEach((item, index) => {
		if (readInclude(item) !== null) return;
		const page = resolveNode(yaml, item);
		if (isMap(page)) checkPage(yaml, page, ["pages", index], issues);
	});
	return issues;
}

function checkPage(
	yaml: ParsedYaml,
	page: YAMLMap,
	path: YamlPath,
	issues: LayoutIssue[],
): void {
	const columnsPath = [...path, "columns"];
	const columnsNode = resolveNode(yaml, getMapValue(yaml, page, "columns"));
	const columns = isSeq(columnsNode) ? columnsNode.items : [];
	if (columns.length === 0) {
		issues.push({
			code: "no-columns",
			message: "A page needs at least one column",
			path: columnsPath,
		});
		return;
	}
	const max = readString(yaml, page, "width") === "slim" ? 2 : 3;
	if (columns.length > max) {
		issues.push({
			code: "too-many-columns",
			params: { max },
			message:
				max === 2
					? "A slim page can have at most 2 columns"
					: "A page can have at most 3 columns",
			path: columnsPath,
		});
	}
	let fullColumns = 0;
	columns.forEach((item, index) => {
		const column = resolveNode(yaml, item);
		const size = isMap(column) ? readString(yaml, column, "size") : null;
		const columnPath = [...columnsPath, index];
		if (size === "full") fullColumns += 1;
		if (size !== "small" && size !== "full") {
			issues.push({
				code: "invalid-column-size",
				params: { size: size ?? "" },
				message: `Column size must be "small" or "full", not ${size === null ? "empty" : `"${size}"`}`,
				path: columnPath,
			});
		}
		if (isMap(column))
			checkWidgetList(yaml, column, "widgets", columnPath, false, issues);
	});
	if (fullColumns < 1 || fullColumns > 2) {
		issues.push({
			code: "full-column-count",
			params: { count: fullColumns },
			message: `A page needs 1 or 2 "full" columns, this one has ${fullColumns}`,
			path: columnsPath,
		});
	}
	checkWidgetList(yaml, page, "head-widgets", path, false, issues);
}

/**
 * Glaze's own editing rules on top of Glance's: rules for things Glance
 * accepts, but that the editor doesn't create, so they are never reported as
 * errors on publish. Edits that add one of these are refused (see `finishEdit`).
 * - No `split-column` in `head-widgets`: head widgets stay one row.
 * @param yaml - The parsed document.
 * @returns Every broken editing rule.
 */
export function glazeLayoutIssues(yaml: ParsedYaml): LayoutIssue[] {
	const issues: LayoutIssue[] = [];
	const pages = resolveNode(yaml, getNodeAt(yaml, ["pages"]));
	if (!isSeq(pages)) return issues;
	pages.items.forEach((item, pageIndex) => {
		const page = resolveNode(yaml, item);
		if (!isMap(page)) return;
		const head = resolveNode(yaml, getMapValue(yaml, page, "head-widgets"));
		if (!isSeq(head)) return;
		head.items.forEach((widgetItem, index) => {
			const widget = resolveNode(yaml, widgetItem);
			if (
				isMap(widget) &&
				readString(yaml, widget, "type") === "split-column"
			) {
				issues.push({
					code: "split-in-head",
					message:
						"Head widgets can't be split; put the split-column in a column instead",
					path: ["pages", pageIndex, "head-widgets", index],
				});
			}
		});
	});
	return issues;
}

function checkWidgetList(
	yaml: ParsedYaml,
	parent: YAMLMap,
	key: string,
	parentPath: YamlPath,
	insideGroup: boolean,
	issues: LayoutIssue[],
): void {
	const list = resolveNode(yaml, getMapValue(yaml, parent, key));
	if (!isSeq(list)) return;
	list.items.forEach((item, index) => {
		const widget = resolveNode(yaml, item);
		if (!isMap(widget)) return;
		const path = [...parentPath, key, index];
		const type = readString(yaml, widget, "type");
		if (insideGroup && type !== null && NOT_IN_GROUP.has(type)) {
			issues.push({
				code: "nested-group",
				params: { type },
				message: `A group can't contain a ${type}`,
				path,
			});
		}
		if (type === "group" || type === "split-column") {
			checkWidgetList(yaml, widget, "widgets", path, type === "group", issues);
		}
	});
}
