export const GLAZE_VERSION = "0.0.0";

export {
	addColumn,
	columnSizeProblem,
	removeColumn,
	setColumnSize,
} from "./columns.ts";
export {
	type GlazeDocument,
	parseConfig,
	replaceSource,
	serializeConfig,
} from "./document.ts";
export {
	COLUMN_KEYS,
	PAGE_KEYS,
	WIDGET_BASE_KEYS,
	WIDGET_TYPE_KEYS,
} from "./glance-keys.ts";
export { glazeLayoutIssues, validateLayout } from "./layout.ts";
export { getModel } from "./model.ts";
export {
	type EnvMatch,
	type EnvReference,
	type EnvReferenceKind,
	findEnvReferences,
	getWidgetOptions,
	type OptionSource,
	type WidgetOption,
	type WidgetOptions,
} from "./options.ts";
export { addPage, movePage, removePage, renamePage } from "./pages.ts";
export {
	findPathAtOffset,
	getNodeRange,
	type LineColumn,
	type NodeRange,
	offsetToLineColumn,
	type PathAtOffset,
} from "./ranges.ts";
export { renameKey } from "./rename-key.ts";
export { getNodeSource } from "./source.ts";
export {
	addToSplitColumn,
	MIN_SPLIT_COLUMNS,
	setSplitColumns,
	type SplitSide,
	type SplitSource,
	unwrapSplitColumn,
	wrapInSplitColumn,
} from "./split-column.ts";
export { err, ok, type Result } from "./result.ts";
export type { NodeKind } from "./model.ts";
export type {
	ColumnNode,
	ColumnSize,
	EditError,
	EditErrorCode,
	IssueSeverity,
	IssueSource,
	LayoutIssue,
	LayoutIssueCode,
	PageNode,
	ParseError,
	RenameKeyFix,
	ValidationIssue,
	WidgetNode,
	YamlPath,
} from "./types.ts";
export {
	addWidget,
	duplicateWidget,
	moveWidget,
	removeWidget,
	removeWidgetOption,
	setWidgetOption,
	type WidgetInput,
} from "./widgets.ts";
export {
	closestKey,
	editDistance,
	findUnknownOptions,
	type KnownKeys,
	type UnknownOption,
} from "./unknown-options.ts";
export {
	insertWidgetListItem,
	moveWidgetListItem,
	removeWidgetValue,
	setWidgetValue,
} from "./widget-values.ts";
