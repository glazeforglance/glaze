import { useCallback, useEffect, useRef } from "react";
import { editorStore } from "../store/editor-store.ts";

/** Typing pauses this long before the text is parsed into the document. */
export const CODE_SYNC_DELAY_MS = 400;

/**
 * Debounces typing in the `glance.yml` tab into `applyCode`: one parse (and
 * one document change) per pause instead of one per key.
 * @returns `onChange` for the editor; `isPending` (true while text waits to be
 *   applied); `flush` to apply waiting text right away (e.g. when leaving the view).
 */
export function useCodeSync(): {
	onChange: (text: string) => void;
	isPending: () => boolean;
	flush: () => void;
} {
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const pending = useRef<string | null>(null);

	const flush = useCallback(() => {
		clearTimeout(timer.current);
		const text = pending.current;
		pending.current = null;
		if (text !== null) editorStore.getState().applyCode(text);
	}, []);

	// Nothing typed may get lost when the editor goes away.
	useEffect(() => flush, [flush]);

	const onChange = useCallback(
		(text: string) => {
			pending.current = text;
			clearTimeout(timer.current);
			timer.current = setTimeout(flush, CODE_SYNC_DELAY_MS);
		},
		[flush],
	);

	const isPending = useCallback(() => pending.current !== null, []);

	return { onChange, isPending, flush };
}
