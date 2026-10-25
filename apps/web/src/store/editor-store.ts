import {
	type GlazeDocument,
	getModel,
	type PageNode,
	parseConfig,
} from "@glaze/core";
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
};

/**
 * Creates an editor store. The app uses one shared instance; tests make their own.
 * All document changes will go through `@glaze/core` edit functions, never raw YAML.
 * @returns A Zustand store with state and actions.
 */
export function createEditorStore(): StoreApi<EditorStore> {
	return createStore<EditorStore>()((set) => ({
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
			});
		},

		selectPage: (pageId) =>
			set((state) =>
				state.pages.some((page) => page.id === pageId)
					? { selectedPageId: pageId, selectedWidgetId: null }
					: state,
			),

		selectWidget: (widgetId) => set({ selectedWidgetId: widgetId }),
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
