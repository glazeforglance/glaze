/** Location of a node in the YAML document, e.g. `["pages", 0, "columns", 1, "widgets", 2]`. */
export type YamlPath = readonly (string | number)[];

/** Column sizes Glance accepts. */
export type ColumnSize = "small" | "full";

/** A widget as the UI sees it. */
export interface WidgetNode {
	/** Glaze-only id, stable across edits. Never written to YAML. */
	readonly id: string;
	readonly path: YamlPath;
	/** Widget `type`, also when it comes from a merge key (`<<: *anchor`). */
	readonly type: string | null;
	readonly title: string | null;
	/** True when the whole item is an alias (`- *name`); such widgets can't be edited in place. */
	readonly isAlias: boolean;
	/** Target of a `$include:` / `!include:` item; the rest of the node is then empty. */
	readonly include: string | null;
	/** Child widgets of a `group` or `split-column`. */
	readonly children: readonly WidgetNode[];
}

/** A column of a page. */
export interface ColumnNode {
	readonly id: string;
	readonly path: YamlPath;
	/** Raw `size` value; anything other than `small`/`full` is reported by `validateLayout`. */
	readonly size: string | null;
	readonly widgets: readonly WidgetNode[];
}

/** A page of the dashboard. */
export interface PageNode {
	readonly id: string;
	readonly path: YamlPath;
	readonly name: string | null;
	readonly slug: string | null;
	readonly width: string | null;
	readonly include: string | null;
	readonly headWidgets: readonly WidgetNode[];
	readonly columns: readonly ColumnNode[];
}

/** Codes for the Glance layout rules. */
export type LayoutIssueCode =
	| "no-pages"
	| "no-columns"
	| "too-many-columns"
	| "invalid-column-size"
	| "full-column-count"
	| "nested-group";

/** A broken Glance layout rule. */
export interface LayoutIssue {
	readonly code: LayoutIssueCode;
	readonly message: string;
	/** The node the issue is about. */
	readonly path: YamlPath;
}

/** Why `parseConfig` failed. */
export interface ParseError {
	readonly code: "yaml-syntax" | "unresolved-alias";
	readonly message: string;
	/** 1-based line, when known. */
	readonly line: number | null;
}

/** Codes for failed edits. */
export type EditErrorCode =
	| "invalid-path"
	| "not-found"
	| "index-out-of-range"
	| "unsupported-structure"
	| "widget-is-alias"
	| "option-not-found"
	| "invalid-move"
	| "layout-violation"
	| "invalid-result";

/** Why an edit was refused. The document is left unchanged. */
export interface EditError {
	readonly code: EditErrorCode;
	readonly message: string;
	/** Layout issues the edit would have introduced (only for `layout-violation`). */
	readonly issues: readonly LayoutIssue[];
}
