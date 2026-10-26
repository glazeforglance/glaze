import { useEditor } from "../store/editor-store.ts";
import { isFileDirty, useFiles } from "../store/files-store.ts";

/**
 * Tells whether anything isn't published yet: the config, its draft text in
 * the code view, or one of the asset files.
 * @returns True when there are unpublished changes.
 */
export function useHasUnsavedChanges(): boolean {
	const configDirty = useEditor(
		(state) => state.dirty || state.codeText !== null,
	);
	const filesDirty = useFiles((state) => state.files.some(isFileDirty));
	return configDirty || filesDirty;
}
