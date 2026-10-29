import type { EditorView } from "../store/editor-store.ts";

/** The views, in the order of their shortcuts (Ctrl/Cmd + 1, 2, 3, 4); labels are `views.<id>`. */
export const VIEWS: readonly { readonly id: EditorView }[] = [
	{ id: "design" },
	{ id: "code" },
	{ id: "preview" },
	{ id: "settings" },
];
