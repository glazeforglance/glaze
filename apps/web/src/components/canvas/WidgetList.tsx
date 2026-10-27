import type { WidgetNode } from "@glaze/core";
import type { ReactNode } from "react";
import { dropItemProps, dropListProps } from "../../lib/dnd-measure.ts";
import type { WidgetList as WidgetListModel } from "../../lib/drop-target.ts";
import { DropIndicator } from "../dnd/DropIndicator.tsx";
import { useDragState } from "../dnd/drag-state.ts";
import { DraggableWidget } from "./DraggableWidget.tsx";

export interface WidgetListProps {
	readonly list: WidgetListModel;
	readonly widgets: readonly WidgetNode[];
	/** `stack` for columns, `row` for head widgets. */
	readonly layout: "stack" | "row";
	/** Shown after the widgets and part of the drop area, e.g. "+ Widget". */
	readonly footer?: ReactNode;
}

/**
 * A list of draggable widgets that accepts drops. The whole element is the
 * drop area (also the gaps and the space below the last widget); the drop
 * indicator is drawn on top of it, so the widgets never move during a drag.
 * @param props - The list, its widgets and how to lay them out.
 * @returns The list element.
 */
export function WidgetList({ list, widgets, layout, footer }: WidgetListProps) {
	const { active, indicator } = useDragState();
	const shown = active && indicator?.listId === list.id ? indicator : null;

	return (
		<div
			{...dropListProps(list.id, layout)}
			className="relative flex flex-1 flex-col gap-2"
		>
			<ul
				className={
					layout === "stack"
						? "flex flex-col gap-2"
						: "grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2"
				}
			>
				{widgets.map((widget) => (
					<li key={widget.id} {...dropItemProps(list.id)}>
						<DraggableWidget widget={widget} />
					</li>
				))}
			</ul>
			{/* Room to drop after the last widget, also in an empty list. */}
			<div className="min-h-6 flex-1">{footer}</div>
			{active && shown && <DropIndicator drag={active} indicator={shown} />}
		</div>
	);
}
