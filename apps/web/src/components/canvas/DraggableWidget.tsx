import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { WidgetNode } from "@glaze/core";
import { widgetDisplay } from "../../lib/model.ts";
import type { DragData, DropData } from "../dnd/drag-state.ts";
import { WidgetBlock } from "./WidgetBlock.tsx";

export interface DraggableWidgetProps {
	readonly widget: WidgetNode;
	/** Direction of the list it is in, to tell "before" from "after". */
	readonly axis: DropData["axis"];
}

/**
 * A top-level widget that can be dragged (by its grip) and dropped on.
 * Nested widgets don't use this: they stay inside their group / split-column.
 * @param props - The widget and its list's direction.
 * @returns The widget block, wired up for drag & drop.
 */
export function DraggableWidget({ widget, axis }: DraggableWidgetProps) {
	const { title, abbr, tone } = widgetDisplay(widget);
	const data: DragData = {
		kind: "widget",
		widgetId: widget.id,
		label: title,
		abbr,
		tone,
	};
	const drag = useDraggable({ id: widget.id, data });
	const drop = useDroppable({
		id: widget.id,
		data: { axis } satisfies DropData,
	});

	return (
		<WidgetBlock
			widget={widget}
			blockRef={(element) => {
				drag.setNodeRef(element);
				drop.setNodeRef(element);
			}}
			grip={{ listeners: drag.listeners, attributes: drag.attributes }}
			gripRef={drag.setActivatorNodeRef}
			dimmed={drag.isDragging}
		/>
	);
}
