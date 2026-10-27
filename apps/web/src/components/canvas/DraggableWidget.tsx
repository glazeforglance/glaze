import { useDraggable } from "@dnd-kit/core";
import type { WidgetNode } from "@glaze/core";
import { widgetDisplay } from "../../lib/model.ts";
import type { DragData } from "../dnd/drag-state.ts";
import { WidgetBlock } from "./WidgetBlock.tsx";

export interface DraggableWidgetProps {
	readonly widget: WidgetNode;
}

/**
 * A top-level widget that can be dragged by its grip. Where it can be
 * dropped is worked out from the measured lists, not from dnd-kit droppables.
 * @param props - The widget.
 * @returns The widget block, wired up for drag & drop.
 */
export function DraggableWidget({ widget }: DraggableWidgetProps) {
	const { title, abbr, tone } = widgetDisplay(widget);
	const data: DragData = {
		kind: "widget",
		widgetId: widget.id,
		label: title,
		abbr,
		tone,
	};
	const drag = useDraggable({ id: widget.id, data });

	return (
		<WidgetBlock
			widget={widget}
			blockRef={drag.setNodeRef}
			grip={{ listeners: drag.listeners, attributes: drag.attributes }}
			gripRef={drag.setActivatorNodeRef}
			dimmed={drag.isDragging}
		/>
	);
}
