import { useEffect, useState } from "react";
import { putConfig } from "../lib/api.ts";
import { glanceComesBack } from "../lib/preview.ts";
import {
	editorStore,
	type LastPublish,
	useEditor,
} from "../store/editor-store.ts";
import { useSettings } from "./use-settings.ts";

/** Where undoing the last publish is at. */
export type UndoStatus =
	| { readonly phase: "idle" }
	| { readonly phase: "undoing" }
	| { readonly phase: "failed"; readonly message: string };

/** What the "Glance didn't come back" banner shows and can do. */
export interface GlanceComeback {
	/** True when Glance stopped answering after a publish that changed `server`. */
	readonly down: boolean;
	readonly undo: UndoStatus;
	/** Writes the `glance.yml` from before the last publish back. */
	undoLastPublish(): Promise<void>;
	/** Hides the banner until the next publish. */
	dismiss(): void;
}

/**
 * After a publish that changed a `server` option, checks whether Glance
 * answers again at `GLANCE_URL`. A wrong host or port makes Glance fail to
 * start (or listen where nothing reaches it), so when it stays silent this
 * offers to restore the previous `glance.yml`, which Glaze still has.
 * @returns The banner state and actions.
 */
export function useGlanceComeback(): GlanceComeback {
	const settings = useSettings();
	const glanceUrl =
		settings.status === "ready" ? settings.settings.glanceUrl : null;
	const lastPublish = useEditor((state) => state.lastPublish);
	// The publish Glance didn't come back from; the banner shows while it is the latest.
	const [failed, setFailed] = useState<LastPublish | null>(null);
	const [undo, setUndo] = useState<UndoStatus>({ phase: "idle" });

	useEffect(() => {
		if (glanceUrl === null || lastPublish === null) return;
		if (!lastPublish.touchedServer) return;
		const controller = new AbortController();
		void glanceComesBack(glanceUrl, controller.signal).then((back) => {
			if (controller.signal.aborted) return;
			if (!back) {
				setUndo({ phase: "idle" });
				setFailed(lastPublish);
			}
		});
		return () => controller.abort();
	}, [glanceUrl, lastPublish]);

	const down = failed !== null && failed === lastPublish;

	return {
		down,
		undo,
		undoLastPublish: async () => {
			if (failed === null) return;
			setUndo({ phase: "undoing" });
			// Based on the version this publish wrote: a 409 means someone changed it since.
			const result = await putConfig(
				failed.previousText,
				failed.version,
				true,
				true,
			);
			if (!result.ok) {
				setUndo({
					phase: "failed",
					message:
						result.error.kind === "conflict"
							? "glance.yml changed since this publish, so it wasn't undone. Fix it in the Code view."
							: result.error.message,
				});
				return;
			}
			const editor = editorStore.getState();
			editor.load(failed.previousText, result.value.version);
			// Counts as a publish, so the preview reloads; no text, so no new undo offer.
			editor.markPublished(result.value.version);
			setFailed(null);
			setUndo({ phase: "idle" });
		},
		dismiss: () => setFailed(null),
	};
}
