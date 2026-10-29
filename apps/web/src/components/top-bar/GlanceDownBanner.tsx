import { useGlanceComeback } from "../../hooks/use-glance-comeback.ts";
import { useHasUnsavedChanges } from "../../hooks/use-unsaved.ts";
import { useTranslation } from "react-i18next";

/**
 * Shown under the top bar when Glance didn't answer after a publish that
 * changed a `server` option, with a one-click undo of that publish.
 * @returns The banner, or nothing while Glance is fine.
 */
export function GlanceDownBanner() {
	const { t } = useTranslation();
	const { down, undo, undoLastPublish, dismiss } = useGlanceComeback();
	const unsaved = useHasUnsavedChanges();
	if (!down) return null;
	return (
		<div
			role="alert"
			className="flex shrink-0 items-start gap-3 border-b border-danger/40 bg-danger/10 px-4 py-3 text-sm"
		>
			<div className="flex-1">
				<p className="font-semibold">{t("glanceDown.title")}</p>
				<p className="mt-0.5 text-muted">
					{t("glanceDown.body")}
					{unsaved && ` ${t("glanceDown.dropsEdits")}`}
				</p>
				{undo.phase === "failed" && (
					<p className="mt-1 text-danger">{undo.message}</p>
				)}
			</div>
			<button
				type="button"
				disabled={undo.phase === "undoing"}
				onClick={() => void undoLastPublish()}
				className="cursor-pointer rounded-sm px-2 font-semibold text-danger hover:underline disabled:cursor-wait disabled:opacity-60"
			>
				{undo.phase === "undoing"
					? t("glanceDown.undoing")
					: t("glanceDown.undo")}
			</button>
			<button
				type="button"
				onClick={dismiss}
				className="cursor-pointer rounded-sm px-2 text-muted hover:text-text"
			>
				{t("common.dismiss")}
			</button>
		</div>
	);
}
