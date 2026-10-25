import { Badge } from "../ui/Badge.tsx";
import { GripIcon } from "../ui/icons.tsx";
import type { ActiveDrag } from "./drag-state.ts";

export interface DragPreviewProps {
	readonly drag: ActiveDrag;
}

/**
 * The card that follows the pointer while dragging.
 * @param props - What is being dragged.
 * @returns The preview card.
 */
export function DragPreview({ drag }: DragPreviewProps) {
	return (
		<div className="flex min-h-14 w-[220px] cursor-grabbing items-center gap-2.5 rounded-md border border-accent bg-card-hover px-3 py-2 shadow-2xl shadow-black/60">
			<GripIcon className="size-3.5 shrink-0 text-faint" />
			<Badge text={drag.abbr} tone={drag.tone} />
			<span className="truncate text-sm font-semibold">{drag.label}</span>
		</div>
	);
}
