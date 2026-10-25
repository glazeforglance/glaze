import type {
	DraggableAttributes,
	DraggableSyntheticListeners,
} from "@dnd-kit/core";
import type { WidgetNode } from "@glaze/core";
import { widgetDisplay, widgetSubtitle } from "../../lib/model.ts";
import { useEditor } from "../../store/editor-store.ts";
import { Badge } from "../ui/Badge.tsx";
import { GripIcon } from "../ui/icons.tsx";
import { NestedWidgets } from "./NestedWidgets.tsx";
import { WidgetActions } from "./WidgetActions.tsx";

/** Event listeners and ARIA attributes dnd-kit puts on the drag handle (the grip button). */
export interface GripProps {
	readonly listeners: DraggableSyntheticListeners;
	readonly attributes: DraggableAttributes;
}

export interface WidgetBlockProps {
	readonly widget: WidgetNode;
	/** Children of a group / split-column are drawn smaller. */
	readonly nested?: boolean;
	/** Ref for the whole block (the drop area). */
	readonly blockRef?: (element: HTMLElement | null) => void;
	/** When set, the grip becomes a button that starts dragging. */
	readonly grip?: GripProps;
	/** Registers the grip as the element that starts a drag. */
	readonly gripRef?: (element: HTMLElement | null) => void;
	/** Drawn faded while this widget is being dragged. */
	readonly dimmed?: boolean;
}

/**
 * A widget on the canvas: grip, badge, title and type. Click to select it.
 * Children of a `group` or `split-column` are drawn inside it.
 * @param props - The widget, and drag & drop wiring for top-level widgets.
 * @returns The block element.
 */
export function WidgetBlock({
	widget,
	nested = false,
	blockRef,
	grip,
	gripRef,
	dimmed = false,
}: WidgetBlockProps) {
	const selected = useEditor((state) => state.selectedWidgetId === widget.id);
	const selectWidget = useEditor((state) => state.selectWidget);
	const { title, abbr, tone } = widgetDisplay(widget);

	return (
		<div
			ref={blockRef}
			className={`flex rounded-md border bg-card transition-colors ${dimmed ? "opacity-40" : ""} ${
				selected
					? "border-accent shadow-[0_0_0_1px_var(--color-accent)]"
					: "border-line hover:border-line-strong"
			}`}
		>
			{/* The grip is its own button: keyboard users focus it and press Space to pick the widget up. */}
			{grip && (
				<button
					type="button"
					ref={gripRef}
					{...grip.attributes}
					{...grip.listeners}
					aria-label={`Move ${title}`}
					className="flex w-7 shrink-0 cursor-grab items-start justify-center self-stretch rounded-l-md pt-5 text-faint hover:text-text active:cursor-grabbing"
				>
					<GripIcon className="size-3.5" />
				</button>
			)}
			<div className="relative min-w-0 flex-1">
				{/* The select button is a sibling of the children, never their parent: buttons can't be nested. */}
				<button
					type="button"
					aria-pressed={selected}
					onClick={() => selectWidget(widget.id)}
					className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md text-left ${
						nested
							? "min-h-11 py-1.5 pl-2.5"
							: `min-h-14 py-2 ${grip ? "pl-1" : "pl-3"}`
					} ${selected ? "pr-20" : "pr-3"}`}
				>
					<Badge text={abbr} tone={tone} size={nested ? "sm" : "md"} />
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
				{selected && <WidgetActions widgetId={widget.id} title={title} />}
				{widget.children.length > 0 && <NestedWidgets parent={widget} />}
			</div>
		</div>
	);
}
