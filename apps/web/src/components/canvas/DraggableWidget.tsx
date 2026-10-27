import { useDraggable } from "@dnd-kit/core";
import type { WidgetNode } from "@glaze/core";
import { widgetDisplay } from "../../lib/model.ts";
import type { DragData } from "../dnd/drag-state.ts";
import { WidgetBlock } from "./WidgetBlock.tsx";

export interface DraggableWidgetProps {
	readonly widget: WidgetNode;
	/** Drawn smaller, as a child of a split-column. */
	readonly nested?: boolean;
}

/**
 * A widget that can be dragged by its grip. Where it can be dropped is
 * worked out from the measured lists, not from dnd-kit droppables.
 * @param props - The widget, and whether it is a nested child.
 * @returns The widget block, wired up for drag & drop.
 */
export function DraggableWidget({
	widget,
	nested = false,
}: DraggableWidgetProps) {
	const { title, abbr, tone } = widgetDisplay(widget);
	const data: DragData = {
		kind: "widget",
		widgetId: widget.id,
		widgetType: widget.type,
		label: title,
		abbr,
		tone,
	};
	const drag = useDraggable({ id: widget.id, data });

	return (
		<WidgetBlock
			widget={widget}
			nested={nested}
			blockRef={drag.setNodeRef}
			grip={{ listeners: drag.listeners, attributes: drag.attributes }}
			gripRef={drag.setActivatorNodeRef}
			dimmed={drag.isDragging}
		/>
	);
}
