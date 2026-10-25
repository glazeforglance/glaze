import { useState } from "react";
import { searchCatalog } from "../../lib/widget-catalog.ts";
import { LibraryGroup } from "./LibraryGroup.tsx";
import { LibrarySearch } from "./LibrarySearch.tsx";

/**
 * The left sidebar: all widget types, grouped and searchable.
 * @returns The sidebar element.
 */
export function WidgetLibrary() {
	const [query, setQuery] = useState("");
	const groups = searchCatalog(query);

	return (
		<aside
			aria-label="Widget library"
			className="flex w-[260px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-bg px-4 py-4"
		>
			<LibrarySearch value={query} onChange={setQuery} />
			{groups.length === 0 ? (
				<p className="px-1 text-sm text-muted">No widgets match “{query}”.</p>
			) : (
				groups.map(({ group, entries }) => (
					<LibraryGroup key={group.id} group={group} entries={entries} />
				))
			)}
		</aside>
	);
}
