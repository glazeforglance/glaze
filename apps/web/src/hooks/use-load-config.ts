import { useEffect } from "react";
import { fetchConfig } from "../lib/api.ts";
import { editorStore } from "../store/editor-store.ts";

/**
 * Loads `glance.yml` from the API once, when the editor mounts, and puts it in the store.
 */
export function useLoadConfig(): void {
	useEffect(() => {
		// StrictMode mounts twice in development; aborting the first request avoids a double load.
		const controller = new AbortController();
		void fetchConfig(controller.signal).then((result) => {
			if (controller.signal.aborted) return;
			const { load, fail } = editorStore.getState();
			if (result.ok) load(result.value.text, result.value.version);
			else fail(result.error.message);
		});
		return () => controller.abort();
	}, []);
}
