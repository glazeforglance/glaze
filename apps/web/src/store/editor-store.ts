import {
	addWidget,
	type EditError,
	type GlazeDocument,
	getModel,
	moveWidget,
	type PageNode,
	parseConfig,
	type Result,
	type WidgetInput,
	type YamlPath,
} from "@glaze/core";
import { findWidget, findWidgetByPath } from "../lib/model.ts";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

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
	/** Message about an edit that was refused (e.g. a layout rule); the document is unchanged. */
	readonly notice: string | null;
}

/** What components can do with the editor state. */
export interface EditorActions {
	/** Shows the error screen, e.g. when the API can't be reached. */
	fail(message: string): void;
	/** Parses a freshly loaded config; shows an error when it isn't valid YAML. */
	load(text: string, version: string): void;
	selectPage(pageId: string): void;
	/** Selects a widget on the current page, or clears the selection with `null`. */
	selectWidget(widgetId: string | null): void;
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
	dismissNotice(): void;
}

export type EditorStore = EditorState & EditorActions;

const INITIAL_STATE: EditorState = {
	status: "loading",
	error: null,
	doc: null,
	pages: [],
	version: null,
	dirty: false,
	selectedPageId: null,
	selectedWidgetId: null,
	notice: null,
};

/**
 * Applies the outcome of a core edit: on success the new document and model,
 * on failure only a notice (the document stays exactly as it was).
 */
function applyEdit(
	state: EditorState,
	result: Result<GlazeDocument, EditError>,
	selectAfter: (page: PageNode | null) => string | null,
): Partial<EditorState> {
	if (!result.ok) return { notice: result.error.message };
	const pages = getModel(result.value);
	const page =
		pages.find((candidate) => candidate.id === state.selectedPageId) ?? null;
	return {
		doc: result.value,
		pages,
		dirty: true,
		notice: null,
		selectedWidgetId: selectAfter(page),
	};
}

/**
 * Creates an editor store. The app uses one shared instance; tests make their own.
 * All document changes will go through `@glaze/core` edit functions, never raw YAML.
 * @returns A Zustand store with state and actions.
 */
export function createEditorStore(): StoreApi<EditorStore> {
	return createStore<EditorStore>()((set, get) => ({
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
			const pages = getModel(parsed.value);
			set({
				status: "ready",
				error: null,
				doc: parsed.value,
				pages,
				version,
				dirty: false,
				selectedPageId: pages[0]?.id ?? null,
				selectedWidgetId: null,
				notice: null,
			});
		},

		selectPage: (pageId) =>
			set((state) =>
				state.pages.some((page) => page.id === pageId)
					? { selectedPageId: pageId, selectedWidgetId: null }
					: state,
			),

		selectWidget: (widgetId) => set({ selectedWidgetId: widgetId }),

		moveWidget: (widgetId, toListPath, index) => {
			const state = get();
			const page = selectCurrentPage(state);
			const widget = page ? findWidget(page, widgetId) : null;
			if (!state.doc || !widget) return;
			const result = moveWidget(state.doc, widget.path, toListPath, index);
			// Ids follow their widgets through a move, so the selection stays on it.
			set(applyEdit(state, result, () => widgetId));
		},

		addWidget: (widget, toListPath, index) => {
			const state = get();
			if (!state.doc) return;
			const result = addWidget(state.doc, toListPath, widget, index);
			set(
				applyEdit(state, result, (page) =>
					page
						? (findWidgetByPath(page, [...toListPath, index])?.id ?? null)
						: null,
				),
			);
		},

		dismissNotice: () => set({ notice: null }),
	}));
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
