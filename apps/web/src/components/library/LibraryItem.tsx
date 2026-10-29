import { useDraggable } from "@dnd-kit/core";
import type { BadgeTone, CatalogEntry } from "../../lib/widget-catalog.ts";
import type { DragData } from "../dnd/drag-state.ts";
import { Badge } from "../ui/Badge.tsx";
import { useTranslation } from "react-i18next";

export interface LibraryItemProps {
	readonly entry: CatalogEntry;
	readonly tone: BadgeTone;
}

/**
 * A widget type in the library. Drag it into a column (or press Space and use
 * the arrow keys) to add a new widget of this type.
 * @param props - The catalog entry and its badge color.
 * @returns The list item with its drag button.
 */
export function LibraryItem({ entry, tone }: LibraryItemProps) {
	const { t } = useTranslation();
	const data: DragData = {
		kind: "library",
		type: entry.type,
		label: entry.label,
		abbr: entry.abbr,
		tone,
	};
	const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
		id: `library:${entry.type}`,
		data,
	});

	return (
		<li>
			<button
				type="button"
				ref={setNodeRef}
				{...attributes}
				{...listeners}
				aria-label={t("library.add", { name: entry.label })}
				title={entry.type}
				className={`flex min-h-11 w-full cursor-grab items-center gap-3 rounded-sm px-2 text-start text-[15px] text-text hover:bg-card active:cursor-grabbing ${
					isDragging ? "opacity-40" : ""
				}`}
			>
				<Badge text={entry.abbr} tone={tone} />
				{entry.label}
			</button>
		</li>
	);
}
