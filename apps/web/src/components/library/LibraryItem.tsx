import type { BadgeTone, CatalogEntry } from "../../lib/widget-catalog.ts";
import { Badge } from "../ui/Badge.tsx";

export interface LibraryItemProps {
	readonly entry: CatalogEntry;
	readonly tone: BadgeTone;
}

/**
 * A widget type in the library. Becomes draggable in step 2c.
 * @param props - The catalog entry and its badge color.
 * @returns The list item.
 */
export function LibraryItem({ entry, tone }: LibraryItemProps) {
	return (
		<li
			title={entry.type}
			className="flex min-h-11 items-center gap-3 rounded-sm px-2 text-[15px] text-text"
		>
			<Badge text={entry.abbr} tone={tone} />
			{entry.label}
		</li>
	);
}
