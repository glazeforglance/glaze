import { useState } from "react";
import { searchCatalog } from "../../lib/widget-catalog.ts";
import { SidePanel } from "../layout/SidePanel.tsx";
import { LibraryGroup } from "./LibraryGroup.tsx";
import { LibrarySearch } from "./LibrarySearch.tsx";
import { Trans, useTranslation } from "react-i18next";

/**
 * The sidebar at the inline start (left in LTR): all widget types, grouped and searchable. Resizable
 * (200–420 px) and collapsible.
 * @returns The sidebar element.
 */
export function WidgetLibrary() {
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const groups = searchCatalog(query);

	return (
		<SidePanel
			id="library"
			side="start"
			label={t("library.panelName")}
			defaultWidth={260}
			min={200}
			max={420}
		>
			<aside
				aria-label={t("library.label")}
				className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto border-e border-line bg-bg px-4 py-4"
			>
				<LibrarySearch value={query} onChange={setQuery} />
				{groups.length === 0 ? (
					<p className="px-1 text-sm text-muted">
						<Trans
							i18nKey="library.noMatch"
							values={{ query }}
							components={{ query: <bdi /> }}
						/>
					</p>
				) : (
					groups.map(({ group, entries }) => (
						<LibraryGroup key={group.id} group={group} entries={entries} />
					))
				)}
			</aside>
		</SidePanel>
	);
}
