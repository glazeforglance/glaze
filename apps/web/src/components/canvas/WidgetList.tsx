import type { WidgetNode } from "@glaze/core";
import type { ReactNode } from "react";
import { dropItemProps, dropListProps } from "../../lib/dnd-measure.ts";
import type { WidgetList as WidgetListModel } from "../../lib/drop-target.ts";
import { DropIndicator } from "../dnd/DropIndicator.tsx";
import { useDragState } from "../dnd/drag-state.ts";
import { DraggableWidget } from "./DraggableWidget.tsx";
import { ListKindContext } from "./list-context.ts";

export interface WidgetListProps {
	readonly list: WidgetListModel;
	readonly widgets: readonly WidgetNode[];
	/**
	 * `stack` for columns, `row` for head widgets, `grid` for a split-column's
	 * children (`columns` equal columns, filled row by row).
	 */
	readonly layout: "stack" | "row" | "grid";
	/** Number of columns for the `grid` layout. */
	readonly columns?: number;
	/** Shown after the widgets and part of the drop area, e.g. "+ Widget". */
	readonly footer?: ReactNode;
	/** Extra content drawn over one item, e.g. a resize handle. */
	readonly itemOverlay?: (widget: WidgetNode) => ReactNode;
}

/**
 * A list of draggable widgets that accepts drops. The whole element is the
 * drop area (also the gaps and the space after the last widget); the drop
 * indicator is drawn on top of it, so the widgets never move during a drag.
 * @param props - The list, its widgets and how to lay them out.
 * @returns The list element.
 */
export function WidgetList({
	list,
	widgets,
	layout,
	columns = 2,
	footer,
	itemOverlay,
}: WidgetListProps) {
	const { active, indicator } = useDragState();
	const shown = active && indicator?.listId === list.id ? indicator : null;
	const nested = layout === "grid";

	return (
		<ListKindContext value={list.kind}>
			<div
				{...dropListProps(list.id, layout === "stack" ? "stack" : "row")}
				className={`relative flex flex-col gap-2 ${nested ? "" : "flex-1"}`}
			>
				<ul
					className={
						layout === "stack"
							? "flex flex-col gap-2"
							: layout === "row"
								? "grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2"
								: "grid gap-2"
					}
					style={
						nested
							? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
							: undefined
					}
				>
					{widgets.map((widget) => (
						<li
							key={widget.id}
							{...dropItemProps(list.id)}
							className="relative min-w-0"
						>
							<DraggableWidget widget={widget} nested={nested} />
							{itemOverlay?.(widget)}
						</li>
					))}
				</ul>
				{/* Room to drop after the last widget, also in an empty list. */}
				<div className={nested ? "min-h-3" : "min-h-6 flex-1"}>{footer}</div>
				{active && shown && <DropIndicator drag={active} indicator={shown} />}
			</div>
		</ListKindContext>
	);
}
