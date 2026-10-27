import { createContext, useContext } from "react";
import type { IndicatorLine } from "../../lib/dnd-geometry.ts";
import type { DropTarget } from "../../lib/drop-target.ts";
import type { BadgeTone } from "../../lib/widget-catalog.ts";

interface DragLook {
	readonly label: string;
	readonly abbr: string;
	readonly tone: BadgeTone;
}

/** Data a draggable registers with dnd-kit (`useDraggable({ data })`). */
export type DragData =
	| (DragLook & { readonly kind: "widget"; readonly widgetId: string })
	| (DragLook & { readonly kind: "library"; readonly type: string });

/** What is being dragged; a widget also knows where it came from. */
export type ActiveDrag =
	| (DragLook & {
			readonly kind: "widget";
			readonly widgetId: string;
			readonly source: DropTarget;
	  })
	| (DragLook & { readonly kind: "library"; readonly type: string });

/** The drop indicator: which list draws it, and where (relative to that list). */
export interface DragIndicator extends IndicatorLine {
	readonly listId: string;
}

/** The drag in progress, shared with the lists that draw the drop indicator. */
export interface DragState {
	readonly active: ActiveDrag | null;
	readonly target: DropTarget | null;
	readonly indicator: DragIndicator | null;
}

export const DragStateContext = createContext<DragState>({
	active: null,
	target: null,
	indicator: null,
});

/**
 * Reads the drag in progress.
 * @returns What is being dragged and where it would land.
 */
export function useDragState(): DragState {
	return useContext(DragStateContext);
}
