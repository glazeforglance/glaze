import { isAlias, isMap, isSeq, type YAMLMap } from "yaml";
import type { GlazeDocument } from "./document.ts";
import type { ColumnNode, PageNode, WidgetNode, YamlPath } from "./types.ts";
import {
	getNodeAt,
	type ParsedYaml,
	readInclude,
	readString,
	resolveNode,
} from "./yaml-read.ts";

/** The kinds of nodes that get a Glaze id. */
export type NodeKind = "page" | "column" | "widget";

type IdLookup = (path: YamlPath, kind: NodeKind) => string;

/** Widget types that contain other widgets in a `widgets` list. */
const CONTAINER_TYPES = new Set(["group", "split-column"]);

/**
 * Builds the page → column → widget model the UI works with.
 * @param doc - The document to read.
 * @returns One `PageNode` per item in `pages`, in file order.
 */
export function getModel(doc: GlazeDocument): PageNode[] {
	return buildPages(doc.yaml, (path) => doc.ids.get(pathKey(path)) ?? "");
}

/**
 * Lists the path of every page, column and widget in the document.
 * @param yaml - The parsed document.
 * @returns Paths with the kind of node found there.
 */
export function listNodePaths(
	yaml: ParsedYaml,
): { path: YamlPath; kind: NodeKind }[] {
	const found: { path: YamlPath; kind: NodeKind }[] = [];
	buildPages(yaml, (path, kind) => {
		found.push({ path, kind });
		return "";
	});
	return found;
}

/**
 * Turns a path into a string usable as a map key.
 * @param path - A YAML path.
 * @returns A stable string for that path.
 */
export function pathKey(path: YamlPath): string {
	return JSON.stringify(path);
}

function buildPages(yaml: ParsedYaml, idOf: IdLookup): PageNode[] {
	const pages = getNodeAt(yaml, ["pages"]);
	if (!isSeq(pages)) return [];
	return pages.items.map((item, index) =>
		buildPage(yaml, item, ["pages", index], idOf),
	);
}

function buildPage(
	yaml: ParsedYaml,
	item: unknown,
	path: YamlPath,
	idOf: IdLookup,
): PageNode {
	const id = idOf(path, "page");
	const node = resolveNode(yaml, item);
	// Lists inside an alias have no path of their own, so only direct maps get children.
	const map = isMap(node) ? node : null;
	const own = isMap(item) ? item : null;
	return {
		id,
		path,
		name: map ? readString(yaml, map, "name") : null,
		slug: map ? readString(yaml, map, "slug") : null,
		width: map ? readString(yaml, map, "width") : null,
		include: readInclude(item),
		headWidgets: buildWidgetList(yaml, own, "head-widgets", path, idOf),
		columns: listItems(own, "columns").map((column, index) =>
			buildColumn(yaml, column, [...path, "columns", index], idOf),
		),
	};
}

function buildColumn(
	yaml: ParsedYaml,
	item: unknown,
	path: YamlPath,
	idOf: IdLookup,
): ColumnNode {
	const id = idOf(path, "column");
	const node = resolveNode(yaml, item);
	const own = isMap(item) ? item : null;
	return {
		id,
		path,
		size: isMap(node) ? readString(yaml, node, "size") : null,
		widgets: buildWidgetList(yaml, own, "widgets", path, idOf),
	};
}

function buildWidgetList(
	yaml: ParsedYaml,
	map: YAMLMap | null,
	key: string,
	parentPath: YamlPath,
	idOf: IdLookup,
): WidgetNode[] {
	return listItems(map, key).map((item, index) =>
		buildWidget(yaml, item, [...parentPath, key, index], idOf),
	);
}

function buildWidget(
	yaml: ParsedYaml,
	item: unknown,
	path: YamlPath,
	idOf: IdLookup,
): WidgetNode {
	const id = idOf(path, "widget");
	const node = resolveNode(yaml, item);
	const map = isMap(node) ? node : null;
	const type = map ? readString(yaml, map, "type") : null;
	const own = isMap(item) ? item : null;
	return {
		id,
		path,
		type,
		title: map ? readString(yaml, map, "title") : null,
		isAlias: isAlias(item),
		include: readInclude(item),
		children:
			type !== null && CONTAINER_TYPES.has(type)
				? buildWidgetList(yaml, own, "widgets", path, idOf)
				: [],
		maxColumns:
			type === "split-column" && map ? readMaxColumns(yaml, map) : null,
	};
}

/** `max-columns` as Glance uses it: anything below 2 (or missing) becomes 2. */
function readMaxColumns(yaml: ParsedYaml, map: YAMLMap): number {
	const value = Number(readString(yaml, map, "max-columns"));
	return Number.isInteger(value) && value >= 2 ? value : 2;
}

function listItems(map: YAMLMap | null, key: string): unknown[] {
	if (!map) return [];
	const list = map.get(key, true);
	return isSeq(list) ? list.items : [];
}
