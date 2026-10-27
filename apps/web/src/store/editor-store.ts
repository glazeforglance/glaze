import {
	addColumn,
	addPage,
	addToSplitColumn,
	addWidget,
	type ColumnNode,
	type ColumnSize,
	duplicateWidget,
	type EditError,
	type GlazeDocument,
	getModel,
	insertWidgetListItem,
	movePage,
	moveWidget,
	moveWidgetListItem,
	type NodeKind,
	type PageNode,
	type ParseError,
	parseConfig,
	type Result,
	removeColumn,
	removePage,
	removeWidget,
	removeWidgetOption,
	removeWidgetValue,
	renameKey,
	renamePage,
	replaceSource,
	setColumnSize,
	setSplitColumns,
	setWidgetOption,
	setWidgetValue,
	type SplitSide,
	type SplitSource,
	unwrapSplitColumn,
	type ValidationIssue,
	type WidgetInput,
	type WidgetNode,
	wrapInSplitColumn,
	type YamlPath,
} from "@glaze/core";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
	findWidget,
	findWidgetByPath,
	nextPageName,
	parentWidget,
} from "../lib/model.ts";
import type { WidgetWidth } from "../lib/widget-width.ts";

/** The three main views of the editor. */
export type EditorView = "design" | "code" | "preview";

/** Validation results, with the draft they belong to. */
export interface ValidationResult {
	/** The exact text that was validated; results for older text are stale. */
	readonly text: string;
	readonly issues: readonly ValidationIssue[];
}

/**
 * A change Glaze made on its own (e.g. dissolving a split-column that was
 * left with one widget), with the document from just before it, so the user
 * can undo it from the notice.
 */
export interface UndoNotice {
	readonly message: string;
	readonly restore: GlazeDocument;
}

/** Where a widget in a drag & drop edit comes from. */
export type WidgetSource =
	| { readonly kind: "new"; readonly widget: WidgetInput }
	| { readonly kind: "move"; readonly widgetId: string };

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
	/** Message about a change Glaze made by itself, with a way to undo it. */
	readonly undoNotice: UndoNotice | null;
	readonly view: EditorView;
	/**
	 * Text in the code view that isn't valid YAML. While set, `doc` is the last
	 * valid version, and Design edits are refused so this text isn't lost.
	 */
	readonly codeText: string | null;
	/** Why `codeText` doesn't parse. */
	readonly codeError: ParseError | null;
	/** Latest validation of the draft, from `/api/validate`. */
	readonly validation: ValidationResult | null;
	/** Counts successful publishes; the preview reloads when it changes. */
	readonly publishCount: number;
	/** Counts Ctrl/Cmd+S presses; the Publish button opens its review on a change. */
	readonly publishRequest: number;
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
	setView(view: EditorView): void;
	/**
	 * Takes the text from the code view. Valid YAML replaces the document (one
	 * change, keeping the selection when its path still exists); invalid YAML is
	 * kept in `codeText` and the document stays as it was.
	 */
	applyCode(text: string): void;
	/** Selects the page (and widget) at a path, e.g. from the cursor in the code view. */
	selectPath(path: YamlPath, kind: NodeKind): void;
	/** Renames a key, e.g. the "Fix" for `stlye` → `style`. */
	renameKey(mapPath: YamlPath, from: string, to: string): boolean;
	setValidation(validation: ValidationResult | null): void;
	/** Asks for the publish review dialog (Ctrl/Cmd+S). */
	requestPublish(): void;
	selectPage(pageId: string): void;
	/** Selects a widget on the current page, or clears the selection with `null`. */
	selectWidget(widgetId: string | null): void;
	dismissNotice(): void;
	/** Explains why something the user tried isn't possible (same place as refused edits). */
	showNotice(message: string): void;
	/** Restores the document from before the change in `undoNotice`. */
	undoFromNotice(): void;
	dismissUndoNotice(): void;

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
	/**
	 * Puts a widget beside another one: into a new split-column, or into the
	 * target's split-column when the target is one. Selects the placed widget.
	 * @param source - A new widget from the library, or a widget to move.
	 * @param targetId - The widget to put it beside.
	 * @param side - Left or right of the target.
	 */
	dropBeside(source: WidgetSource, targetId: string, side: SplitSide): void;
	/** Sets a split-column's `max-columns`: the width of every widget in it. */
	setSplitColumns(splitId: string, columns: number): boolean;
	/**
	 * Gives a widget a width: `full`, or 1/n through its split-column. A widget
	 * that isn't in one yet gets a split-column of its own; `full` takes it out
	 * of its split-column again.
	 */
	setWidgetWidth(widgetId: string, width: WidgetWidth): boolean;
	/** Dissolves a split-column: its widgets take its place, one below the other. */
	unwrapSplit(splitId: string): boolean;

	/*
	 * Option edits for the inspector. Each returns whether the edit was applied,
	 * so a form field can reset itself when it was refused.
	 */
	/** Sets a top-level option; on an inherited option this writes an override. */
	setWidgetOption(widgetId: string, key: string, value: unknown): boolean;
	/** Removes a top-level option the widget sets itself. */
	removeWidgetOption(widgetId: string, key: string): boolean;
	/** Sets a value below an option, e.g. `["sites", 2, "url"]`. */
	setWidgetValue(widgetId: string, subPath: YamlPath, value: unknown): boolean;
	/** Removes a key or list item below an option. */
	removeWidgetValue(widgetId: string, subPath: YamlPath): boolean;
	/** Adds an item to a list option; defaults to the end. */
	insertWidgetListItem(
		widgetId: string,
		listSubPath: YamlPath,
		value: unknown,
		index?: number,
	): boolean;
	/** Moves an item within a list option (`toIndex` counted without the item). */
	moveWidgetListItem(
		widgetId: string,
		listSubPath: YamlPath,
		fromIndex: number,
		toIndex: number,
	): boolean;
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
	undoNotice: null,
	view: "design",
	codeText: null,
	codeError: null,
	validation: null,
	publishCount: 0,
	publishRequest: 0,
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
		 * stays exactly as it was. Returns whether the edit was applied.
		 */
		const runEdit = (
			edit: (doc: GlazeDocument) => Result<GlazeDocument, EditError>,
			selectAfter: (pages: readonly PageNode[]) => Selection = () => ({}),
		): boolean => {
			const { doc, codeText } = get();
			if (!doc) return false;
			if (codeText !== null) {
				set({
					notice:
						"The YAML in the Code view has errors. Fix them there before editing here.",
				});
				return false;
			}
			const result = edit(doc);
			if (!result.ok) {
				set({ notice: result.error.message });
				return false;
			}
			// No-op edits (e.g. a move to the same index) return the same document.
			if (result.value === doc) return true;
			const pages = getModel(result.value);
			set({
				doc: result.value,
				pages,
				dirty: true,
				notice: null,
				undoNotice: null,
				...selectAfter(pages),
			});
			return true;
		};

		/**
		 * After a widget left a split-column: a split-column with one widget
		 * left is dissolved, with a notice that can undo that.
		 */
		const unwrapIfSingle = (splitId: string | null): void => {
			if (splitId === null) return;
			const split = widgetOnPage(splitId);
			const before = get().doc;
			if (!split || split.children.length !== 1 || !before) return;
			// Ids follow the remaining widget, so a selection on it stays.
			const applied = runEdit((doc) => unwrapSplitColumn(doc, split.path));
			if (applied) {
				set({
					undoNotice: {
						message:
							"The split-column had one widget left, so it was turned back into a normal widget.",
						restore: before,
					},
				});
			}
		};

		/** The split-column a widget is in, if any (to unwrap it after a move out). */
		const splitParentId = (widget: WidgetNode): string | null => {
			const page = selectCurrentPage(get());
			const parent = page ? parentWidget(page, widget) : null;
			return parent?.type === "split-column" ? parent.id : null;
		};

		/** Turns a store-level source into a core one. */
		const coreSource = (source: WidgetSource): SplitSource | null => {
			if (source.kind === "new") return source;
			const widget = widgetOnPage(source.widgetId);
			return widget ? { kind: "move", path: widget.path } : null;
		};

		/** Runs an option edit on a widget of the current page. Option edits keep widget ids. */
		const editWidget = (
			widgetId: string,
			edit: (
				doc: GlazeDocument,
				path: YamlPath,
			) => Result<GlazeDocument, EditError>,
		): boolean => {
			const widget = widgetOnPage(widgetId);
			if (!widget) return false;
			return runEdit((doc) => edit(doc, widget.path));
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
					codeText: null,
					codeError: null,
					validation: null,
				});
			},

			markPublished: (version) =>
				set((state) => ({
					version,
					dirty: false,
					publishCount: state.publishCount + 1,
				})),

			setView: (view) => set({ view }),

			applyCode: (text) => {
				const state = get();
				if (!state.doc) return;
				const result = replaceSource(state.doc, text);
				if (!result.ok) {
					set({ codeText: text, codeError: result.error });
					return;
				}
				if (result.value === state.doc) {
					if (state.codeText !== null) set({ codeText: null, codeError: null });
					return;
				}
				// Ids follow paths, so a selection whose path still exists keeps its id.
				const pages = getModel(result.value);
				const page =
					pages.find((candidate) => candidate.id === state.selectedPageId) ??
					pages[0] ??
					null;
				const widgetId =
					page && state.selectedWidgetId !== null
						? (findWidget(page, state.selectedWidgetId)?.id ?? null)
						: null;
				set({
					doc: result.value,
					pages,
					dirty: true,
					notice: null,
					codeText: null,
					codeError: null,
					selectedPageId: page?.id ?? null,
					selectedWidgetId: widgetId,
				});
			},

			selectPath: (path, kind) => {
				const state = get();
				const pageIndex = path[1];
				const page =
					typeof pageIndex === "number" ? state.pages[pageIndex] : undefined;
				if (!page) return;
				const widgetId =
					kind === "widget" ? (findWidgetByPath(page, path)?.id ?? null) : null;
				if (
					page.id === state.selectedPageId &&
					widgetId === state.selectedWidgetId
				) {
					return;
				}
				set({ selectedPageId: page.id, selectedWidgetId: widgetId });
			},

			renameKey: (mapPath, from, to) =>
				runEdit((doc) => renameKey(doc, mapPath, from, to)),

			setValidation: (validation) => set({ validation }),

			requestPublish: () =>
				set((state) => ({ publishRequest: state.publishRequest + 1 })),

			selectPage: (pageId) =>
				set((state) =>
					state.pages.some((page) => page.id === pageId)
						? { selectedPageId: pageId, selectedWidgetId: null }
						: state,
				),

			selectWidget: (widgetId) => set({ selectedWidgetId: widgetId }),

			dismissNotice: () => set({ notice: null }),

			showNotice: (message) => set({ notice: message }),

			undoFromNotice: () => {
				const { undoNotice, selectedWidgetId } = get();
				if (!undoNotice) return;
				const pages = getModel(undoNotice.restore);
				const page =
					pages.find((candidate) => candidate.id === get().selectedPageId) ??
					null;
				set({
					doc: undoNotice.restore,
					pages,
					dirty: true,
					notice: null,
					undoNotice: null,
					selectedWidgetId:
						page &&
						selectedWidgetId !== null &&
						findWidget(page, selectedWidgetId)
							? selectedWidgetId
							: null,
				});
			},

			dismissUndoNotice: () => set({ undoNotice: null }),

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
				const fromSplit = splitParentId(widget);
				// Ids follow their widgets through a move, so the selection stays on it.
				const applied = runEdit(
					(doc) => moveWidget(doc, widget.path, toListPath, index),
					() => ({ selectedWidgetId: widgetId }),
				);
				if (applied) unwrapIfSingle(fromSplit);
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

			dropBeside: (source, targetId, side) => {
				const target = widgetOnPage(targetId);
				const from = coreSource(source);
				if (!target || !from) return;
				const moved =
					source.kind === "move" ? widgetOnPage(source.widgetId) : null;
				const fromSplit = moved ? splitParentId(moved) : null;
				const before = new Set(allWidgetIds(selectCurrentPage(get())));
				const applied = runEdit(
					(doc) =>
						target.type === "split-column"
							? addToSplitColumn(
									doc,
									target.path,
									from,
									side === "left" ? 0 : undefined,
								)
							: wrapInSplitColumn(doc, target.path, from, side),
					(pages) => {
						if (source.kind === "move") {
							return { selectedWidgetId: source.widgetId };
						}
						// The new widget is the one id that wasn't there before (besides a new split-column).
						const page = pages.find((p) => p.id === get().selectedPageId);
						const added = allWidgets(page).find(
							(widget) =>
								!before.has(widget.id) && widget.type === source.widget.type,
						);
						return { selectedWidgetId: added?.id ?? null };
					},
				);
				if (applied && fromSplit !== targetId) unwrapIfSingle(fromSplit);
			},

			unwrapSplit: (splitId) =>
				editWidget(splitId, (doc, path) => unwrapSplitColumn(doc, path)),

			setSplitColumns: (splitId, columns) =>
				editWidget(splitId, (doc, path) => setSplitColumns(doc, path, columns)),

			setWidgetWidth: (widgetId, width) => {
				const widget = widgetOnPage(widgetId);
				const page = selectCurrentPage(get());
				if (!widget || !page) return false;
				const parent = parentWidget(page, widget);
				if (parent?.type === "split-column") {
					if (width !== "full") {
						return get().setSplitColumns(parent.id, width);
					}
					// Full width: out of the split-column, right after it.
					const index = parent.path[parent.path.length - 1];
					if (typeof index !== "number") return false;
					get().moveWidget(widgetId, parent.path.slice(0, -1), index + 1);
					return true;
				}
				if (width === "full") return true;
				return runEdit(
					(doc) => wrapInSplitColumn(doc, widget.path, null, "left", width),
					() => ({ selectedWidgetId: widgetId }),
				);
			},

			setWidgetOption: (widgetId, key, value) =>
				editWidget(widgetId, (doc, path) =>
					setWidgetOption(doc, path, key, value),
				),

			removeWidgetOption: (widgetId, key) =>
				editWidget(widgetId, (doc, path) => removeWidgetOption(doc, path, key)),

			setWidgetValue: (widgetId, subPath, value) =>
				editWidget(widgetId, (doc, path) =>
					setWidgetValue(doc, path, subPath, value),
				),

			removeWidgetValue: (widgetId, subPath) =>
				editWidget(widgetId, (doc, path) =>
					removeWidgetValue(doc, path, subPath),
				),

			insertWidgetListItem: (widgetId, listSubPath, value, index) =>
				editWidget(widgetId, (doc, path) =>
					insertWidgetListItem(doc, path, listSubPath, value, index),
				),

			moveWidgetListItem: (widgetId, listSubPath, fromIndex, toIndex) =>
				editWidget(widgetId, (doc, path) =>
					moveWidgetListItem(doc, path, listSubPath, fromIndex, toIndex),
				),
		};
	});
}

/** Every widget on a page, nested ones included. */
function allWidgets(page: PageNode | null | undefined): WidgetNode[] {
	if (!page) return [];
	const walk = (widgets: readonly WidgetNode[]): WidgetNode[] =>
		widgets.flatMap((widget) => [widget, ...walk(widget.children)]);
	return [
		...walk(page.headWidgets),
		...page.columns.flatMap((column) => walk(column.widgets)),
	];
}

function allWidgetIds(page: PageNode | null): string[] {
	return allWidgets(page).map((widget) => widget.id);
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
