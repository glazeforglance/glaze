export const GLAZE_VERSION = "0.0.0";

export { addColumn, removeColumn, setColumnSize } from "./columns.ts";
export {
	type GlazeDocument,
	parseConfig,
	serializeConfig,
} from "./document.ts";
export { validateLayout } from "./layout.ts";
export { getModel } from "./model.ts";
export { addPage, movePage, removePage, renamePage } from "./pages.ts";
export { getNodeSource } from "./source.ts";
export { err, ok, type Result } from "./result.ts";
export type {
	ColumnNode,
	ColumnSize,
	EditError,
	EditErrorCode,
	LayoutIssue,
	LayoutIssueCode,
	PageNode,
	ParseError,
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
