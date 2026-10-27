import { useEditor } from "../../store/editor-store.ts";
import { CopyIcon, TrashIcon } from "../ui/icons.tsx";

export interface WidgetActionsProps {
	readonly widgetId: string;
	/** Widget title, for the buttons' accessible names. */
	readonly title: string;
	/** `corner`: over the block's top-right corner; `row`: a row of its own (narrow nested blocks). */
	readonly placement?: "corner" | "row";
}

const ACTION =
	"flex size-8 cursor-pointer items-center justify-center rounded-sm border border-line bg-card-hover text-muted";

/**
 * Duplicate and delete buttons on the selected widget, as in the mockup.
 * Deleting asks nothing: it only changes the editor until you publish.
 * @param props - The widget and its title.
 * @returns The two buttons.
 */
export function WidgetActions({
	widgetId,
	title,
	placement = "corner",
}: WidgetActionsProps) {
	const duplicateWidget = useEditor((state) => state.duplicateWidget);
	const removeWidget = useEditor((state) => state.removeWidget);
	return (
		<div
			className={
				placement === "corner"
					? "absolute top-2 right-2 flex gap-1"
					: "flex justify-end gap-1 px-1.5 pb-1.5"
			}
		>
			<button
				type="button"
				aria-label={`Duplicate ${title}`}
				title="Duplicate"
				onClick={() => duplicateWidget(widgetId)}
				className={`${ACTION} hover:text-text`}
			>
				<CopyIcon />
			</button>
			<button
				type="button"
				aria-label={`Delete ${title}`}
				title="Delete (Del)"
				onClick={() => removeWidget(widgetId)}
				className={`${ACTION} hover:border-danger/50 hover:text-danger`}
			>
				<TrashIcon />
			</button>
		</div>
	);
}
