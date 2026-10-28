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

/**
 * Values for a message's placeholders. Glaze's own problems carry a `code`
 * plus these, so the web app can build the sentence in the user's language;
 * `message` stays English for logs and API clients.
 */
export type MessageParams = Readonly<Record<string, string | number>>;

/** A problem for the user: a stable code, its values and the English sentence. */
export interface Problem<Code extends string = string> {
	readonly code: Code;
	readonly params?: MessageParams;
	readonly message: string;
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
	/** E.g. `{ max: 2 }` for `too-many-columns`. */
	readonly params?: MessageParams;
	readonly message: string;
	/** The node the issue is about. */
	readonly path: YamlPath;
}

/** Why `parseConfig` failed. */
export interface ParseError {
	readonly code: "yaml-syntax" | "unresolved-alias";
	/** `{ alias }` for `unresolved-alias`; a syntax error only has the yaml package's (English) message. */
	readonly params?: MessageParams;
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
	/** E.g. `{ key }` for `duplicate-key`. */
	readonly params?: MessageParams;
	/** English, with details for developers (paths); the web app shows a sentence per code. */
	readonly message: string;
	/** Layout issues the edit would have introduced (only for `layout-violation`). */
	readonly issues: readonly LayoutIssue[];
}

/** Why a column can't get a size (`columnSizeProblem`). */
export type ColumnSizeProblemCode =
	| "column-needs-full"
	| "column-too-many-full";

/** Why a page's URL path won't work (`slugProblem`). */
export type SlugProblemCode = "slug-reserved" | "slug-taken";

/** Codes for a broken `server.host`, `server.port` or `server.base-url`. */
export type ServerOptionProblemCode =
	| "host-not-text"
	| "host-is-url"
	| "host-unclosed-bracket"
	| "host-bad-ipv6"
	| "host-ipv6-needs-brackets"
	| "host-invalid"
	| "port-invalid"
	| "base-url-invalid";

/** Codes for every validation issue Glaze reports (see `ValidationIssue.code`). */
export type IssueCode =
	| ParseError["code"]
	| LayoutIssueCode
	| ServerOptionProblemCode
	/** Host/port change while Glance runs behind a port mapping. */
	| "listen-in-container"
	/** `{ widget, option, list?, item? }`: fields.json keys of the widget and option. */
	| "missing-option"
	/** `{ key }` */
	| "unknown-option"
	/** `{ key, suggestion }` */
	| "unknown-option-suggestion"
	| "glance-validation-off"
	/** `{ output }`: Glance's own (English) words. */
	| "glance-output"
	/** `{ output }`: depends on the machine Glance runs on. */
	| "glance-output-machine"
	/** `{ reference }`: a `${secret:…}` or `${readFileFromEnv:…}`. */
	| "glance-reads-file"
	| "assets-unchecked"
	| "assets-path-missing"
	| "glance-unrunnable"
	| "glance-timeout"
	/** `{ reason }` */
	| "glance-failed";

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
	/**
	 * Glaze's own checks set a code (and `params`), so the web app can show
	 * the issue in the user's language. Without one (Glance's own output,
	 * the yaml package's syntax errors) `message` is shown as it is.
	 */
	readonly code?: IssueCode;
	readonly params?: MessageParams;
	/** English. */
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
