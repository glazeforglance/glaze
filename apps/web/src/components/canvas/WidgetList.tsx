import { useDroppable } from "@dnd-kit/core";
import type { WidgetNode } from "@glaze/core";
import { Fragment, type ReactNode } from "react";
import { listDropId } from "../../lib/dnd-geometry.ts";
import type { WidgetList as WidgetListModel } from "../../lib/drop-target.ts";
import { DropIndicator } from "../dnd/DropIndicator.tsx";
import { useDragState } from "../dnd/drag-state.ts";
import { DraggableWidget } from "./DraggableWidget.tsx";
import { ListEndZone } from "./ListEndZone.tsx";

export interface WidgetListProps {
	readonly list: WidgetListModel;
	readonly widgets: readonly WidgetNode[];
	/** `stack` for columns, `row` for head widgets. */
	readonly layout: "stack" | "row";
	/** Shown after the widgets and part of the end drop zone, e.g. "+ Widget". */
	readonly footer?: ReactNode;
}

/**
 * A list of draggable widgets that accepts drops, with the drop indicator at
 * the position the dragged widget would land.
 * @param props - The list, its widgets and how to lay them out.
 * @returns The list element.
 */
export function WidgetList({ list, widgets, layout, footer }: WidgetListProps) {
	const { active, target } = useDragState();
	const { setNodeRef } = useDroppable({ id: listDropId(list.id) });
	const indicatorAt =
		active && target?.listId === list.id ? target.index : null;
	const axis = layout === "stack" ? "y" : "x";

	return (
		<div ref={setNodeRef} className="flex flex-1 flex-col gap-2">
			<ul
				className={
					layout === "stack"
						? "flex flex-col gap-2"
						: "grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2"
				}
			>
				{widgets.map((widget, index) => (
					<Fragment key={widget.id}>
						{active && indicatorAt === index && <DropIndicator drag={active} />}
						<li>
							<DraggableWidget widget={widget} axis={axis} />
						</li>
					</Fragment>
				))}
				{active && indicatorAt === widgets.length && (
					<DropIndicator drag={active} />
				)}
			</ul>
			<ListEndZone listId={list.id}>{footer}</ListEndZone>
		</div>
	);
}
