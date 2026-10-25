import { useDroppable } from "@dnd-kit/core";
import { INDICATOR_DROP_ID } from "../../lib/dnd-geometry.ts";
import type { ActiveDrag } from "./drag-state.ts";

export interface DropIndicatorProps {
	readonly drag: ActiveDrag;
}

/**
 * The dashed amber box that shows where the dragged widget will land.
 * Hidden from screen readers: dnd-kit announces the position instead.
 * @param props - What is being dragged.
 * @returns The indicator, as a list item.
 */
export function DropIndicator({ drag }: DropIndicatorProps) {
	const verb = drag.kind === "library" ? "add" : "move";
	const { setNodeRef } = useDroppable({ id: INDICATOR_DROP_ID });
	return (
		<li
			ref={setNodeRef}
			aria-hidden="true"
			className="flex min-h-14 items-center justify-center rounded-md border-2 border-dashed border-accent bg-accent/5 px-3 py-2 text-center text-sm text-accent"
		>
			Drop to {verb} “{drag.label}”
		</li>
	);
}
