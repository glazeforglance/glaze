import type { EditorView } from "../store/editor-store.ts";

/** The views, in the order of their shortcuts (Ctrl/Cmd + 1, 2, 3, 4). */
export const VIEWS: readonly {
	readonly id: EditorView;
	readonly label: string;
}[] = [
	{ id: "design", label: "Design" },
	{ id: "code", label: "Code" },
	{ id: "preview", label: "Preview" },
	{ id: "settings", label: "Settings" },
];
