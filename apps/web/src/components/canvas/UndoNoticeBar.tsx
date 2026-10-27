import { useEditor } from "../../store/editor-store.ts";

/**
 * Tells the user about a change Glaze made by itself (e.g. dissolving a
 * split-column with one widget left), with a button to undo just that.
 * @returns The message, or nothing when there is none.
 */
export function UndoNoticeBar() {
	const notice = useEditor((state) => state.undoNotice);
	const undo = useEditor((state) => state.undoFromNotice);
	const dismiss = useEditor((state) => state.dismissUndoNotice);
	if (notice === null) return null;
	return (
		<div
			role="status"
			className="mb-4 flex items-start gap-3 rounded-md border border-info/40 bg-info/10 px-4 py-3 text-sm"
		>
			<p className="flex-1">{notice.message}</p>
			<button
				type="button"
				onClick={undo}
				className="cursor-pointer rounded-sm px-2 font-semibold text-info hover:underline"
			>
				Undo
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
