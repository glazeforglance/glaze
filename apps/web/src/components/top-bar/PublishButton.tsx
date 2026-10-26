import { useEffect, useRef } from "react";
import { usePublish } from "../../hooks/use-publish.ts";
import {
	hasUnsavedChanges,
	useHasUnsavedChanges,
} from "../../hooks/use-unsaved.ts";
import { useEditor } from "../../store/editor-store.ts";
import { Button } from "../ui/Button.tsx";
import { CheckIcon } from "../ui/icons.tsx";
import { PublishDialog } from "./PublishDialog.tsx";
import { PublishReviewDialog } from "./PublishReviewDialog.tsx";

/**
 * Publishes the config and edited asset files, so Glance picks them up.
 * Opens a review dialog first (also with Ctrl/Cmd+S); problems while writing
 * open the error dialog.
 * @returns The button, a short "Published" confirmation and the dialogs.
 */
export function PublishButton() {
	const dirty = useHasUnsavedChanges();
	const publishRequest = useEditor((state) => state.publishRequest);
	const { status, review, publish, overwrite, reload, dismiss } = usePublish();
	const busy = status.phase === "publishing";

	// Ctrl/Cmd+S asks for the review dialog through the store; each request once.
	const handledRequest = useRef(publishRequest);
	useEffect(() => {
		if (publishRequest === handledRequest.current) return;
		handledRequest.current = publishRequest;
		if (hasUnsavedChanges()) review();
	}, [publishRequest, review]);

	return (
		<>
			<span role="status" className="text-sm text-success">
				{status.phase === "published" && !dirty && (
					<span className="inline-flex items-center gap-1">
						<CheckIcon /> Published
					</span>
				)}
			</span>
			<Button
				variant="primary"
				className="px-4"
				aria-keyshortcuts="Control+S Meta+S"
				title="Publish (Ctrl+S)"
				unavailable={
					busy ? "Publishing…" : dirty ? undefined : "No changes to publish"
				}
				onClick={review}
			>
				{busy ? "Publishing…" : "Publish"}
			</Button>
			<PublishReviewDialog
				open={status.phase === "reviewing"}
				onCancel={dismiss}
				onPublish={(force) => void publish(force)}
			/>
			<PublishDialog
				error={status.phase === "failed" ? status.error : null}
				onOverwrite={(version) => void overwrite(version)}
				onReload={() => void reload()}
				onClose={dismiss}
			/>
		</>
	);
}
