import { useGlanceComeback } from "../../hooks/use-glance-comeback.ts";
import { useHasUnsavedChanges } from "../../hooks/use-unsaved.ts";

/**
 * Shown under the top bar when Glance didn't answer after a publish that
 * changed a `server` option, with a one-click undo of that publish.
 * @returns The banner, or nothing while Glance is fine.
 */
export function GlanceDownBanner() {
	const { down, undo, undoLastPublish, dismiss } = useGlanceComeback();
	const unsaved = useHasUnsavedChanges();
	if (!down) return null;
	return (
		<div
			role="alert"
			className="flex shrink-0 items-start gap-3 border-b border-danger/40 bg-danger/10 px-4 py-3 text-sm"
		>
			<div className="flex-1">
				<p className="font-semibold">
					Glance didn't come back after this change
				</p>
				<p className="mt-0.5 text-muted">
					A wrong listen address or port can stop Glance from starting, or make
					it listen where your Docker port mapping doesn't reach.
					{unsaved && " Undoing also drops your unpublished edits."}
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
				{undo.phase === "undoing" ? "Undoing…" : "Undo last publish"}
			</button>
			<button
				type="button"
				onClick={dismiss}
				className="cursor-pointer rounded-sm px-2 text-muted hover:text-text"
			>
				Dismiss
			</button>
		</div>
	);
}
