import { serializeConfig } from "@glaze/core";
import { useEffect } from "react";
import { validateConfig } from "../lib/api.ts";
import { editorStore, useEditor } from "../store/editor-store.ts";

/**
 * Waits this long after the draft changes before validating. The draft itself
 * changes 400 ms after typing stops, so issues show ≈800 ms after a pause.
 */
export const VALIDATION_DELAY_MS = 400;

/**
 * The draft as the code view shows it: the invalid text while there is one,
 * otherwise the document.
 * @returns The draft text, or `null` before a config is loaded.
 */
export function useDraftText(): string | null {
	return useEditor(
		(state) =>
			state.codeText ?? (state.doc ? serializeConfig(state.doc) : null),
	);
}

/**
 * Validates the draft through `/api/validate` whenever it changes (debounced),
 * cancelling the request for an older draft, and stores the result.
 * @param enabled - Validate only while true (e.g. while the Code view shows).
 */
export function useValidation(enabled = true): void {
	const text = useDraftText();

	useEffect(() => {
		if (!enabled || text === null) return;
		if (editorStore.getState().validation?.text === text) return;
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			const result = await validateConfig(text, controller.signal);
			if (controller.signal.aborted) return;
			editorStore.getState().setValidation({
				text,
				issues: result.ok
					? result.value
					: [
							{
								severity: "warning",
								source: "glaze",
								message: `Validation is unavailable: ${result.error.message}`,
							},
						],
			});
		}, VALIDATION_DELAY_MS);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [enabled, text]);
}
