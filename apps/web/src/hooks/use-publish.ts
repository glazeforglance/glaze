import { serializeConfig } from "@glaze/core";
import { useEffect, useRef, useState } from "react";
import { fetchConfig, type PublishError, putConfig } from "../lib/api.ts";
import { editorStore } from "../store/editor-store.ts";

/** Where publishing is at. */
export type PublishStatus =
	| { readonly phase: "idle" }
	| { readonly phase: "publishing" }
	| { readonly phase: "published" }
	| { readonly phase: "failed"; readonly error: PublishError };

/** What the publish button and dialog can do. */
export interface Publisher {
	readonly status: PublishStatus;
	/** Writes the document, based on the version it was loaded from. */
	publish(): Promise<void>;
	/** After a conflict: write anyway, replacing the file that changed on disk. */
	overwrite(diskVersion: string): Promise<void>;
	/** After a conflict: throw away local changes and load the file from disk. */
	reload(): Promise<void>;
	/** Closes the dialog and keeps the local changes. */
	dismiss(): void;
}

/**
 * The publish flow: PUT the serialized document to the API and handle the
 * answers (409 conflict, 422 invalid, network errors). Local changes are never
 * lost unless the user picks "Reload".
 * @returns Status and actions for the publish UI.
 */
export function usePublish(): Publisher {
	const [status, setStatus] = useState<PublishStatus>({ phase: "idle" });
	// "Published" is shown for a few seconds, then the status goes back to idle.
	const doneTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	useEffect(() => () => clearTimeout(doneTimer.current), []);

	const write = async (baseVersion: string) => {
		const { doc } = editorStore.getState();
		if (!doc) return;
		setStatus({ phase: "publishing" });
		const result = await putConfig(serializeConfig(doc), baseVersion);
		if (result.ok) {
			editorStore.getState().markPublished(result.value.version);
			setStatus({ phase: "published" });
			clearTimeout(doneTimer.current);
			doneTimer.current = setTimeout(() => setStatus({ phase: "idle" }), 3000);
		} else {
			setStatus({ phase: "failed", error: result.error });
		}
	};

	return {
		status,
		publish: async () => {
			const { version } = editorStore.getState();
			if (version !== null) await write(version);
		},
		overwrite: (diskVersion) => write(diskVersion),
		reload: async () => {
			setStatus({ phase: "publishing" });
			const result = await fetchConfig();
			if (result.ok) {
				editorStore.getState().load(result.value.text, result.value.version);
				setStatus({ phase: "idle" });
			} else {
				setStatus({
					phase: "failed",
					error: { kind: "network", message: result.error.message },
				});
			}
		},
		dismiss: () => setStatus({ phase: "idle" }),
	};
}
