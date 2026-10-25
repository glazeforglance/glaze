import { usePublish } from "../../hooks/use-publish.ts";
import { useEditor } from "../../store/editor-store.ts";
import { Button } from "../ui/Button.tsx";
import { CheckIcon } from "../ui/icons.tsx";
import { PublishDialog } from "./PublishDialog.tsx";

/**
 * Writes the edited config to disk, so Glance picks it up.
 * Disabled while there is nothing to publish; problems open a dialog.
 * @returns The button, a short "Published" confirmation and the error dialog.
 */
export function PublishButton() {
	const dirty = useEditor((state) => state.dirty);
	const { status, publish, overwrite, reload, dismiss } = usePublish();
	const busy = status.phase === "publishing";
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
				unavailable={
					busy ? "Publishing…" : dirty ? undefined : "No changes to publish"
				}
				onClick={() => void publish()}
			>
				{busy ? "Publishing…" : "Publish"}
			</Button>
			<PublishDialog
				error={status.phase === "failed" ? status.error : null}
				onOverwrite={(version) => void overwrite(version)}
				onReload={() => void reload()}
				onClose={dismiss}
			/>
		</>
	);
}
