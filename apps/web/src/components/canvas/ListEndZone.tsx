import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { endDropId } from "../../lib/dnd-geometry.ts";

export interface ListEndZoneProps {
	readonly listId: string;
	readonly children?: ReactNode;
}

/**
 * The area after a list's last widget: dropping here adds to the end.
 * It is also where the keyboard can move to after the last widget, so it
 * always has some height, even when it has no content.
 * @param props - The list it belongs to, and optional content ("+ Widget").
 * @returns The drop zone.
 */
export function ListEndZone({ listId, children }: ListEndZoneProps) {
	const { setNodeRef } = useDroppable({ id: endDropId(listId) });
	return (
		<div ref={setNodeRef} className="min-h-6 flex-1">
			{children}
		</div>
	);
}
