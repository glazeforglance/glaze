import { DndContext, DragOverlay } from "@dnd-kit/core";
import { type ReactNode, useMemo } from "react";
import { useEditorDnd } from "../../hooks/use-editor-dnd.ts";
import { listsOfPage } from "../../lib/drop-target.ts";
import { selectCurrentPage, useEditor } from "../../store/editor-store.ts";
import { DragPreview } from "./DragPreview.tsx";
import { DragStateContext } from "./drag-state.ts";
import { useLanguage } from "../../i18n.ts";

export interface EditorDndContextProps {
	readonly children: ReactNode;
}

/**
 * Wraps the library and the canvas so widgets can be dragged between them.
 * @param props - The editor areas that take part in drag & drop.
 * @returns The drag & drop context with its drag preview.
 */
export function EditorDndContext({ children }: EditorDndContextProps) {
	const page = useEditor(selectCurrentPage);
	// The lists carry translated labels, so they follow the language too.
	const { language } = useLanguage();
	const lists = useMemo(
		() => (page && language ? listsOfPage(page) : []),
		[page, language],
	);
	const { state, dndProps } = useEditorDnd(lists);

	return (
		<DndContext {...dndProps}>
			<DragStateContext value={state}>{children}</DragStateContext>
			{/* No drop animation: the widget is re-rendered in its new place right away. */}
			<DragOverlay dropAnimation={null}>
				{state.active ? <DragPreview drag={state.active} /> : null}
			</DragOverlay>
		</DndContext>
	);
}
