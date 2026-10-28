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
export { glazeLayoutIssues, validateLayout } from "./layout.ts";
export { getModel } from "./model.ts";
export {
	type EnvMatch,
	type EnvReference,
	type EnvReferenceKind,
	findEnvReferences,
	getMapOptions,
	getWidgetOptions,
	type OptionSource,
	type WidgetOption,
	type WidgetOptions,
} from "./options.ts";
export {
	addPage,
	movePage,
	RESERVED_SLUGS,
	removePage,
	renamePage,
	slugFromName,
	slugProblem,
} from "./pages.ts";
export {
	findPathAtOffset,
	getNodeRange,
	type LineColumn,
	type NodeRange,
	offsetToLineColumn,
	type PathAtOffset,
} from "./ranges.ts";
export { renameKey } from "./rename-key.ts";
export {
	CONTAINER_LISTEN_WARNING,
	type ContainerHints,
	changedListenOptions,
	DEFAULT_GLANCE_PORT,
	glanceRunsInContainer,
	HOST_NOT_A_URL,
	isIPv6,
	type ListenOptionKey,
	type ServerOptionIssue,
	type ServerOptionKey,
	type ServerOptionProblem,
	serverOptionProblem,
	serverSectionChanged,
	validateServerOptions,
} from "./server-options.ts";
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
	ColumnSizeProblemCode,
	EditError,
	EditErrorCode,
	IssueCode,
	IssueSeverity,
	IssueSource,
	LayoutIssue,
	LayoutIssueCode,
	MessageParams,
	PageNode,
	ParseError,
	Problem,
	RenameKeyFix,
	ServerOptionProblemCode,
	SlugProblemCode,
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
	insertListItemAt,
	insertWidgetListItem,
	moveListItemAt,
	moveWidgetListItem,
	removeValueAt,
	removeWidgetValue,
	setValueAt,
	setWidgetValue,
} from "./widget-values.ts";
