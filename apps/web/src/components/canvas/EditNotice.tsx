import { useEditor } from "../../store/editor-store.ts";
import { useTranslation } from "react-i18next";

/**
 * Explains why the last edit was refused (e.g. a Glance layout rule).
 * The document is unchanged when this shows.
 * @returns The message, or nothing when there is none.
 */
export function EditNotice() {
	const { t } = useTranslation();
	const notice = useEditor((state) => state.notice);
	const dismissNotice = useEditor((state) => state.dismissNotice);
	if (notice === null) return null;
	return (
		<div
			role="alert"
			className="mb-4 flex items-start gap-3 rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm"
		>
			<p className="flex-1">
				<span className="font-semibold text-danger">
					{t("canvas.notChanged")}{" "}
				</span>
				{notice}
			</p>
			<button
				type="button"
				onClick={dismissNotice}
				className="cursor-pointer rounded-sm px-2 text-muted hover:text-text"
			>
				{t("common.dismiss")}
			</button>
		</div>
	);
}
