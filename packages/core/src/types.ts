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
	/**
	 * For a `split-column`: the number of columns Glance draws (`max-columns`,
	 * at least 2, as Glance enforces). `null` for other widgets.
	 */
	readonly maxColumns: number | null;
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
	| "nested-group"
	/** A `split-column` in `head-widgets` (Glaze keeps head widgets one row). */
	| "split-in-head";

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
	/** 1-based column, when known. */
	readonly column: number | null;
}

/** Codes for failed edits. */
export type EditErrorCode =
	| "invalid-path"
	| "not-found"
	| "index-out-of-range"
	| "unsupported-structure"
	| "widget-is-alias"
	| "option-not-found"
	/** The value only comes from a merge key (`<<: *anchor`); editing it would change the anchor. */
	| "option-inherited"
	/** The value is an alias (`*name`); editing it would change the anchored node. */
	| "option-is-alias"
	| "invalid-move"
	/** The new key is already set in the same map. */
	| "duplicate-key"
	| "layout-violation"
	| "invalid-result";

/** Why an edit was refused. The document is left unchanged. */
export interface EditError {
	readonly code: EditErrorCode;
	readonly message: string;
	/** Layout issues the edit would have introduced (only for `layout-violation`). */
	readonly issues: readonly LayoutIssue[];
}

/** How serious a validation issue is. `info` never blocks anything. */
export type IssueSeverity = "error" | "warning" | "info";

/** Which check found a validation issue. */
export type IssueSource = "yaml" | "layout" | "glance" | "glaze";

/** A one-click fix for an issue: rename a key, e.g. `stlye` → `style`. */
export interface RenameKeyFix {
	readonly kind: "rename-key";
	/** Path of the map that holds the key. */
	readonly mapPath: YamlPath;
	readonly from: string;
	readonly to: string;
}

/** One problem found in a draft config; shared by the API and the web app. */
export interface ValidationIssue {
	readonly severity: IssueSeverity;
	readonly source: IssueSource;
	readonly message: string;
	/** 1-based line in the draft, when known. */
	readonly line?: number;
	/** 1-based column, when known. */
	readonly column?: number;
	/** The node the issue is about, when known. */
	readonly path?: YamlPath;
	readonly fix?: RenameKeyFix;
	/**
	 * Publishing needs an explicit "I understand" for this issue, e.g. a port
	 * change that a Docker port mapping won't follow.
	 */
	readonly requiresConfirmation?: boolean;
	/** A page in Glaze's docs that explains the issue. */
	readonly docsUrl?: string;
}
