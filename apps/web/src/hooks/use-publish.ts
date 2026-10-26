import { serializeConfig } from "@glaze/core";
import { useEffect, useRef, useState } from "react";
import {
	fetchConfig,
	type PublishError,
	putConfig,
	putFile,
} from "../lib/api.ts";
import { editorStore } from "../store/editor-store.ts";
import { filesStore, isFileDirty } from "../store/files-store.ts";

/** Where publishing is at. */
export type PublishStatus =
	| { readonly phase: "idle" }
	/** The review dialog is open: issues and changed files are shown. */
	| { readonly phase: "reviewing" }
	| { readonly phase: "publishing" }
	| { readonly phase: "published" }
	| { readonly phase: "failed"; readonly error: PublishError };

/** What the publish button and dialogs can do. */
export interface Publisher {
	readonly status: PublishStatus;
	/** Opens the review dialog (also Ctrl/Cmd+S). */
	review(): void;
	/**
	 * Writes everything that changed: `glance.yml` (based on the version it was
	 * loaded from) and then the edited asset files.
	 * @param force - Write the config even when validation finds errors.
	 */
	publish(force: boolean): Promise<void>;
	/** After a conflict: write anyway, replacing the file that changed on disk. */
	overwrite(diskVersion: string): Promise<void>;
	/** After a conflict: throw away local changes and load the file from disk. */
	reload(): Promise<void>;
	/** Closes the dialog and keeps the local changes. */
	dismiss(): void;
}

/**
 * Tells whether `glance.yml` itself has something to publish.
 * @returns True when the document or its draft text changed.
 */
export function configNeedsPublish(): boolean {
	const { dirty, codeText } = editorStore.getState();
	return dirty || codeText !== null;
}

/**
 * The publish flow: review → PUT the config (the server validates it again)
 * → PUT each changed asset file. Handles 409 conflicts, 422 validation errors
 * and network errors. Local changes are never lost unless the user picks "Reload".
 * @returns Status and actions for the publish UI.
 */
export function usePublish(): Publisher {
	const [status, setStatus] = useState<PublishStatus>({ phase: "idle" });
	// "Published" is shown for a few seconds, then the status goes back to idle.
	const doneTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	useEffect(() => () => clearTimeout(doneTimer.current), []);

	const write = async (baseVersion: string, force: boolean) => {
		const editor = editorStore.getState();
		if (!editor.doc) return;
		setStatus({ phase: "publishing" });

		let version = baseVersion;
		if (configNeedsPublish() || baseVersion !== editor.version) {
			// The draft text when it doesn't parse, so the server explains the error.
			const text = editor.codeText ?? serializeConfig(editor.doc);
			const result = await putConfig(text, baseVersion, force);
			if (!result.ok) {
				setStatus({ phase: "failed", error: result.error });
				return;
			}
			version = result.value.version;
		}

		for (const file of filesStore.getState().files.filter(isFileDirty)) {
			const result = await putFile(file.name, file.text, file.version);
			if (!result.ok) {
				// The config is already written; record that before reporting.
				editorStore.getState().markPublished(version);
				setStatus({ phase: "failed", error: result.error });
				return;
			}
			filesStore
				.getState()
				.markSaved(file.name, file.text, result.value.version);
		}

		// Also counts publishes of only asset files, so the preview reloads.
		editorStore.getState().markPublished(version);
		setStatus({ phase: "published" });
		clearTimeout(doneTimer.current);
		doneTimer.current = setTimeout(() => setStatus({ phase: "idle" }), 3000);
	};

	return {
		status,
		review: () =>
			setStatus((current) =>
				current.phase === "publishing" ? current : { phase: "reviewing" },
			),
		publish: async (force) => {
			const { version } = editorStore.getState();
			if (version !== null) await write(version, force);
		},
		overwrite: (diskVersion) => write(diskVersion, false),
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
