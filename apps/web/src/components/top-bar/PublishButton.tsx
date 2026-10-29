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
import { useTranslation } from "react-i18next";

/**
 * Publishes the config and edited asset files, so Glance picks them up.
 * Opens a review dialog first (also with Ctrl/Cmd+S); problems while writing
 * open the error dialog.
 * @returns The button, a short "Published" confirmation and the dialogs.
 */
export function PublishButton() {
	const { t } = useTranslation();
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
						<CheckIcon /> {t("publish.published")}
					</span>
				)}
			</span>
			<Button
				variant="primary"
				className="px-4"
				aria-keyshortcuts="Control+S Meta+S"
				title={t("publish.buttonTitle")}
				unavailable={
					busy
						? t("publish.publishing")
						: dirty
							? undefined
							: t("publish.nothingToPublish")
				}
				onClick={review}
			>
				{busy ? t("publish.publishing") : t("publish.button")}
			</Button>
			<PublishReviewDialog
				open={status.phase === "reviewing"}
				onCancel={dismiss}
				onPublish={(force, confirmed) => void publish(force, confirmed)}
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
