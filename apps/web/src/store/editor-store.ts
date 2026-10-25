import {
	addColumn,
	addPage,
	addWidget,
	type ColumnNode,
	type ColumnSize,
	duplicateWidget,
	type EditError,
	type GlazeDocument,
	getModel,
	movePage,
	moveWidget,
	type PageNode,
	parseConfig,
	type Result,
	removeColumn,
	removePage,
	removeWidget,
	renamePage,
	setColumnSize,
	type WidgetInput,
	type YamlPath,
} from "@glaze/core";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { findWidget, findWidgetByPath, nextPageName } from "../lib/model.ts";

/** Everything the editor shows, in one place. */
export interface EditorState {
	readonly status: "loading" | "ready" | "error";
	readonly error: string | null;
	readonly doc: GlazeDocument | null;
	/** Derived from `doc` with `getModel`; recomputed on every change. */
	readonly pages: readonly PageNode[];
	/** Version of the file on disk this document is based on. */
	readonly version: string | null;
	/** True when the document has changes that aren't published yet. */
	readonly dirty: boolean;
	readonly selectedPageId: string | null;
	readonly selectedWidgetId: string | null;
	/** Page whose tab is being renamed inline. */
	readonly renamingPageId: string | null;
	/** Message about an edit that was refused (e.g. a layout rule); the document is unchanged. */
	readonly notice: string | null;
}

/** What components can do with the editor state. */
export interface EditorActions {
	/** Shows the error screen, e.g. when the API can't be reached. */
	fail(message: string): void;
	/**
	 * Parses a config from disk and replaces the document (first load, or "Reload"
	 * after a conflict). Keeps the open page by position when possible.
	 */
	load(text: string, version: string): void;
	/** Records a successful publish: the file on disk now matches the document. */
	markPublished(version: string): void;
	selectPage(pageId: string): void;
	/** Selects a widget on the current page, or clears the selection with `null`. */
	selectWidget(widgetId: string | null): void;
	dismissNotice(): void;

	/** Adds a page at the end, opens it and starts renaming it. */
	addPage(): void;
	startRename(pageId: string): void;
	cancelRename(): void;
	/** Renames a page; an empty name is refused with a notice. */
	renamePage(pageId: string, name: string): void;
	/** Removes a page and opens its neighbour. */
	removePage(pageId: string): void;
	/** Moves a page to a new position (counted without the moved page). */
	movePage(pageId: string, toIndex: number): void;

	/** Adds a column at the end of the open page. */
	addColumn(size: ColumnSize): void;
	removeColumn(columnId: string): void;
	setColumnSize(columnId: string, size: ColumnSize): void;

	/**
	 * Moves a widget of the current page to a widget list.
	 * @param widgetId - The widget to move.
	 * @param toListPath - Target list, e.g. a column's `widgets`.
	 * @param index - Position in the target list, counted without the moved widget.
	 */
	moveWidget(widgetId: string, toListPath: YamlPath, index: number): void;
	/**
	 * Adds a new widget to a list of the current page and selects it.
	 * @param widget - The widget to write, e.g. `{ type: "clock", title: "Clock" }`.
	 * @param toListPath - Target list.
	 * @param index - Position in the target list.
	 */
	addWidget(widget: WidgetInput, toListPath: YamlPath, index: number): void;
	/** Copies a widget of the current page right after itself and selects the copy. */
	duplicateWidget(widgetId: string): void;
	/** Removes a widget of the current page. */
	removeWidget(widgetId: string): void;
}

export type EditorStore = EditorState & EditorActions;

type Selection = Partial<
	Pick<EditorState, "selectedPageId" | "selectedWidgetId" | "renamingPageId">
>;

const INITIAL_STATE: EditorState = {
	status: "loading",
	error: null,
	doc: null,
	pages: [],
	version: null,
	dirty: false,
	selectedPageId: null,
	selectedWidgetId: null,
	renamingPageId: null,
	notice: null,
};

function findColumn(
	pages: readonly PageNode[],
	columnId: string,
): ColumnNode | null {
	for (const page of pages) {
		const column = page.columns.find((candidate) => candidate.id === columnId);
		if (column) return column;
	}
	return null;
}

/**
 * Creates an editor store. The app uses one shared instance; tests make their own.
 * All document changes go through `@glaze/core` edit functions, never raw YAML.
 * @returns A Zustand store with state and actions.
 */
export function createEditorStore(): StoreApi<EditorStore> {
	return createStore<EditorStore>()((set, get) => {
		/**
		 * Runs one core edit. On success: new document and model, marked dirty,
		 * selection from `selectAfter`. On failure: only a notice; the document
		 * stays exactly as it was.
		 */
		const runEdit = (
			edit: (doc: GlazeDocument) => Result<GlazeDocument, EditError>,
			selectAfter: (pages: readonly PageNode[]) => Selection = () => ({}),
		): void => {
			const { doc } = get();
			if (!doc) return;
			const result = edit(doc);
			if (!result.ok) {
				set({ notice: result.error.message });
				return;
			}
			const pages = getModel(result.value);
			set({
				doc: result.value,
				pages,
				dirty: true,
				notice: null,
				...selectAfter(pages),
			});
		};

		const pageById = (pageId: string): PageNode | null =>
			get().pages.find((page) => page.id === pageId) ?? null;

		const widgetOnPage = (widgetId: string) => {
			const page = selectCurrentPage(get());
			return page ? findWidget(page, widgetId) : null;
		};

		return {
			...INITIAL_STATE,

			fail: (message) => set({ status: "error", error: message }),

			load: (text, version) => {
				const parsed = parseConfig(text);
				if (!parsed.ok) {
					const { message, line } = parsed.error;
					set({
						status: "error",
						error: line === null ? message : `Line ${line}: ${message}`,
					});
					return;
				}
				const previous = get();
				const openIndex = previous.pages.findIndex(
					(page) => page.id === previous.selectedPageId,
				);
				const pages = getModel(parsed.value);
				set({
					status: "ready",
					error: null,
					doc: parsed.value,
					pages,
					version,
					dirty: false,
					selectedPageId: (pages[openIndex] ?? pages[0])?.id ?? null,
					selectedWidgetId: null,
					renamingPageId: null,
					notice: null,
				});
			},

			markPublished: (version) => set({ version, dirty: false }),

			selectPage: (pageId) =>
				set((state) =>
					state.pages.some((page) => page.id === pageId)
						? { selectedPageId: pageId, selectedWidgetId: null }
						: state,
				),

			selectWidget: (widgetId) => set({ selectedWidgetId: widgetId }),

			dismissNotice: () => set({ notice: null }),

			addPage: () => {
				const name = nextPageName(get().pages);
				runEdit(
					(doc) => addPage(doc, name),
					(pages) => {
						const added = pages[pages.length - 1]?.id ?? null;
						return {
							selectedPageId: added,
							selectedWidgetId: null,
							renamingPageId: added,
						};
					},
				);
			},

			startRename: (pageId) => set({ renamingPageId: pageId }),

			cancelRename: () => set({ renamingPageId: null }),

			renamePage: (pageId, name) => {
				const page = pageById(pageId);
				const trimmed = name.trim();
				if (!page) return;
				if (trimmed === "") {
					set({ notice: "A page needs a name." });
					return;
				}
				if (trimmed === page.name) {
					set({ renamingPageId: null });
					return;
				}
				runEdit(
					(doc) => renamePage(doc, page.path, trimmed),
					() => ({ renamingPageId: null }),
				);
			},

			removePage: (pageId) => {
				const page = pageById(pageId);
				if (!page) return;
				const index = get().pages.indexOf(page);
				runEdit(
					(doc) => removePage(doc, page.path),
					(pages) => ({
						selectedPageId:
							(pages[Math.min(index, pages.length - 1)] ?? null)?.id ?? null,
						selectedWidgetId: null,
						renamingPageId: null,
					}),
				);
			},

			movePage: (pageId, toIndex) => {
				const page = pageById(pageId);
				if (!page) return;
				// Ids follow their pages, so the moved page stays open.
				runEdit((doc) => movePage(doc, page.path, toIndex));
			},

			addColumn: (size) => {
				const page = selectCurrentPage(get());
				if (!page) return;
				runEdit((doc) => addColumn(doc, page.path, size));
			},

			removeColumn: (columnId) => {
				const column = findColumn(get().pages, columnId);
				if (!column) return;
				runEdit(
					(doc) => removeColumn(doc, column.path),
					() => ({ selectedWidgetId: null }),
				);
			},

			setColumnSize: (columnId, size) => {
				const column = findColumn(get().pages, columnId);
				if (!column || column.size === size) return;
				runEdit((doc) => setColumnSize(doc, column.path, size));
			},

			moveWidget: (widgetId, toListPath, index) => {
				const widget = widgetOnPage(widgetId);
				if (!widget) return;
				// Ids follow their widgets through a move, so the selection stays on it.
				runEdit(
					(doc) => moveWidget(doc, widget.path, toListPath, index),
					() => ({ selectedWidgetId: widgetId }),
				);
			},

			addWidget: (widget, toListPath, index) => {
				runEdit(
					(doc) => addWidget(doc, toListPath, widget, index),
					(pages) =>
						selectWidgetAt(pages, get().selectedPageId, [...toListPath, index]),
				);
			},

			duplicateWidget: (widgetId) => {
				const widget = widgetOnPage(widgetId);
				const index = widget?.path[widget.path.length - 1];
				if (!widget || typeof index !== "number") return;
				runEdit(
					(doc) => duplicateWidget(doc, widget.path),
					(pages) =>
						selectWidgetAt(pages, get().selectedPageId, [
							...widget.path.slice(0, -1),
							index + 1,
						]),
				);
			},

			removeWidget: (widgetId) => {
				const widget = widgetOnPage(widgetId);
				if (!widget) return;
				runEdit(
					(doc) => removeWidget(doc, widget.path),
					() => ({ selectedWidgetId: null }),
				);
			},
		};
	});
}

/** Selects the widget at `path` on the open page of the new model. */
function selectWidgetAt(
	pages: readonly PageNode[],
	pageId: string | null,
	path: YamlPath,
): Selection {
	const page = pages.find((candidate) => candidate.id === pageId);
	return {
		selectedWidgetId: page ? (findWidgetByPath(page, path)?.id ?? null) : null,
	};
}

/** The editor store used by the app. */
export const editorStore = createEditorStore();

/**
 * Reads from the app's editor store and re-renders when the selected part changes.
 * @param selector - Picks the part of the state a component needs.
 * @returns The selected value.
 */
export function useEditor<T>(selector: (state: EditorStore) => T): T {
	return useStore(editorStore, selector);
}

/**
 * Returns the page that is currently open.
 * @param state - Editor state.
 * @returns The selected page, or `null` before a config is loaded.
 */
export function selectCurrentPage(state: EditorState): PageNode | null {
	return state.pages.find((page) => page.id === state.selectedPageId) ?? null;
}
