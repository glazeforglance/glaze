import { useEffect } from "react";
import { VIEWS } from "../lib/views.ts";
import { editorStore } from "../store/editor-store.ts";

/**
 * Handles one key press: Ctrl/Cmd+S opens the publish review, Ctrl/Cmd+1/2/3
 * switches between Design, Code and Preview.
 * @param event - The keydown event.
 * @returns True when the key was a Glaze shortcut (and was handled).
 */
export function handleShortcut(event: KeyboardEvent): boolean {
	const mod = event.ctrlKey || event.metaKey;
	if (!mod || event.altKey || event.shiftKey) return false;
	// A modal dialog is open (e.g. the publish review): leave its keys alone.
	if (document.querySelector("dialog[open]")) return false;
	const state = editorStore.getState();
	if (event.key === "s" || event.key === "S") {
		event.preventDefault();
		state.requestPublish();
		return true;
	}
	const view = VIEWS[Number(event.key) - 1];
	if (view && /^[1-3]$/.test(event.key)) {
		event.preventDefault();
		state.setView(view.id);
		return true;
	}
	return false;
}

/**
 * Installs the global keyboard shortcuts. Listens in the capture phase, so the
 * code editor and form fields can't swallow them first.
 */
export function useShortcuts(): void {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			handleShortcut(event);
		};
		window.addEventListener("keydown", onKeyDown, { capture: true });
		return () =>
			window.removeEventListener("keydown", onKeyDown, { capture: true });
	}, []);
}
