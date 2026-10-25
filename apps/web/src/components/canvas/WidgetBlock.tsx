import type { WidgetNode } from "@glaze/core";
import { widgetSubtitle } from "../../lib/model.ts";
import { badgeToneFor, catalogEntry } from "../../lib/widget-catalog.ts";
import { useEditor } from "../../store/editor-store.ts";
import { Badge } from "../ui/Badge.tsx";
import { GripIcon } from "../ui/icons.tsx";
import { NestedWidgets } from "./NestedWidgets.tsx";

export interface WidgetBlockProps {
	readonly widget: WidgetNode;
	/** Children of a group / split-column are drawn smaller and without a grip. */
	readonly nested?: boolean;
}

/**
 * A widget on the canvas: grip, badge, title and type. Click to select it.
 * Children of a `group` or `split-column` are drawn inside it.
 * @param props - The widget and whether it is nested.
 * @returns The block element.
 */
export function WidgetBlock({ widget, nested = false }: WidgetBlockProps) {
	const selected = useEditor((state) => state.selectedWidgetId === widget.id);
	const selectWidget = useEditor((state) => state.selectWidget);
	const entry = catalogEntry(widget.type);
	const abbr = widget.include !== null ? "IN" : entry.abbr;
	const title =
		widget.include !== null ? "Include" : (widget.title ?? entry.label);

	return (
		<div
			className={`rounded-md border bg-card transition-colors ${
				selected
					? "border-accent shadow-[0_0_0_1px_var(--color-accent)]"
					: "border-line hover:border-line-strong"
			}`}
		>
			{/* The select button is a sibling of the children, never their parent: buttons can't be nested. */}
			<button
				type="button"
				aria-pressed={selected}
				onClick={() => selectWidget(widget.id)}
				className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md text-left ${
					nested ? "min-h-11 px-2.5 py-1.5" : "min-h-14 px-3 py-2"
				}`}
			>
				{!nested && <GripIcon className="size-3.5 shrink-0 text-faint" />}
				<Badge
					text={abbr}
					tone={badgeToneFor(widget.type)}
					size={nested ? "sm" : "md"}
				/>
				<span className="min-w-0">
					<span
						className={`block truncate font-semibold ${nested ? "text-[13px]" : "text-sm"}`}
					>
						{title}
					</span>
					<span className="block truncate font-mono text-[11px] text-muted">
						{widgetSubtitle(widget)}
					</span>
				</span>
			</button>
			{widget.children.length > 0 && <NestedWidgets parent={widget} />}
		</div>
	);
}
