import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
	type AssetContent,
	type AssetEntry,
	type AssetList,
	fetchFile,
	fetchFiles,
} from "../lib/api.ts";
import { i18n } from "../i18n.ts";

/** One asset file open in the code view. */
export interface AssetFile {
	readonly name: string;
	readonly language: AssetEntry["language"];
	readonly status: "loading" | "ready" | "error";
	readonly error: string | null;
	/** Text in the editor. */
	readonly text: string;
	/** Text as last loaded or published; `dirty` = `text !== savedText`. */
	readonly savedText: string;
	/** Version on disk (`null` while the file doesn't exist yet). */
	readonly version: string | null;
}

/** The asset files the config references, with their own unsaved changes. */
export interface FilesState {
	readonly files: readonly AssetFile[];
	/** Why referenced files can't be edited (e.g. assets path outside the config folder). */
	readonly unavailable: string | null;
	readonly loaded: boolean;
}

/** What the code view and publish flow can do with asset files. */
export interface FilesActions {
	/** Loads the list of files, then each file's contents. */
	load(): Promise<void>;
	/** Puts a loaded list and contents in place (used by `load`, and by tests). */
	setFiles(
		list: AssetList,
		contents: ReadonlyMap<string, AssetContent | string>,
	): void;
	setText(name: string, text: string): void;
	/** Records that `text` was written to disk as `version`. */
	markSaved(name: string, text: string, version: string): void;
}

export type FilesStore = FilesState & FilesActions;

/**
 * Tells whether an asset file has unpublished changes.
 * @param file - The file.
 * @returns True when its text differs from what is on disk.
 */
export function isFileDirty(file: AssetFile): boolean {
	return file.status === "ready" && file.text !== file.savedText;
}

/**
 * Creates a files store. The app uses one shared instance; tests make their own.
 * @returns A Zustand store with state and actions.
 */
export function createFilesStore(): StoreApi<FilesStore> {
	return createStore<FilesStore>()((set, get) => {
		const update = (name: string, change: Partial<AssetFile>) =>
			set((state) => ({
				files: state.files.map((file) =>
					file.name === name ? { ...file, ...change } : file,
				),
			}));

		return {
			files: [],
			unavailable: null,
			loaded: false,

			load: async () => {
				const list = await fetchFiles();
				if (!list.ok) {
					set({ files: [], unavailable: list.error.message, loaded: true });
					return;
				}
				const contents = new Map<string, AssetContent | string>();
				await Promise.all(
					list.value.files.map(async ({ name }) => {
						const file = await fetchFile(name);
						contents.set(name, file.ok ? file.value : file.error.message);
					}),
				);
				get().setFiles(list.value, contents);
			},

			setFiles: (list, contents) =>
				set({
					loaded: true,
					unavailable: list.unavailable,
					files: list.files.map(({ name, language }) => {
						const content = contents.get(name);
						if (content === undefined || typeof content === "string") {
							return {
								name,
								language,
								status: "error",
								error: content ?? i18n.t("code.notLoaded"),
								text: "",
								savedText: "",
								version: null,
							};
						}
						return {
							name,
							language,
							status: "ready",
							error: null,
							text: content.text,
							savedText: content.text,
							version: content.version,
						};
					}),
				}),

			setText: (name, text) => update(name, { text }),

			markSaved: (name, text, version) =>
				update(name, { savedText: text, version }),
		};
	});
}

/** The files store used by the app. */
export const filesStore = createFilesStore();

/**
 * Reads from the app's files store and re-renders when the selected part changes.
 * @param selector - Picks the part of the state a component needs.
 * @returns The selected value.
 */
export function useFiles<T>(selector: (state: FilesStore) => T): T {
	return useStore(filesStore, selector);
}
