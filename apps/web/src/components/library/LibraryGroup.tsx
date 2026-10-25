import { useId } from "react";
import type { CatalogEntry, WidgetGroup } from "../../lib/widget-catalog.ts";
import { LibraryItem } from "./LibraryItem.tsx";

export interface LibraryGroupProps {
	readonly group: WidgetGroup;
	readonly entries: readonly CatalogEntry[];
}

/**
 * One heading (e.g. "Server") with its widget types.
 * @param props - The group and the entries to show.
 * @returns The section element.
 */
export function LibraryGroup({ group, entries }: LibraryGroupProps) {
	const headingId = useId();
	return (
		<section aria-labelledby={headingId}>
			<h2
				id={headingId}
				className="mb-1 px-1 text-[11px] font-bold tracking-[0.12em] text-muted uppercase"
			>
				{group.label}
			</h2>
			<ul className="flex flex-col">
				{entries.map((entry) => (
					<LibraryItem key={entry.type} entry={entry} tone={group.tone} />
				))}
			</ul>
		</section>
	);
}
