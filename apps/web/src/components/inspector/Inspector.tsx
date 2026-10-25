import { useState } from "react";
import { findWidget } from "../../lib/model.ts";
import { selectCurrentPage, useEditor } from "../../store/editor-store.ts";
import { InspectorHeader } from "./InspectorHeader.tsx";
import { type InspectorTab, InspectorTabs } from "./InspectorTabs.tsx";
import { YamlView } from "./YamlView.tsx";

/**
 * The right sidebar: details of the selected widget.
 * @returns The sidebar element.
 */
export function Inspector() {
	const page = useEditor(selectCurrentPage);
	const selectedWidgetId = useEditor((state) => state.selectedWidgetId);
	const [tab, setTab] = useState<InspectorTab>("settings");
	const widget =
		page && selectedWidgetId ? findWidget(page, selectedWidgetId) : null;

	return (
		<aside
			aria-label="Inspector"
			className="flex w-[330px] shrink-0 flex-col overflow-y-auto border-l border-line bg-bg px-5 py-5"
		>
			{widget === null ? (
				<p className="mt-10 text-center text-sm text-muted">
					Select a widget to see its settings.
				</p>
			) : (
				<>
					<InspectorHeader widget={widget} />
					<InspectorTabs value={tab} onChange={setTab} />
					<div
						role="tabpanel"
						id={`inspector-panel-${tab}`}
						aria-labelledby={`inspector-tab-${tab}`}
						className="pt-4"
					>
						{tab === "settings" && (
							<p className="text-sm text-muted">Forms arrive in phase 3.</p>
						)}
						{tab === "style" && (
							<p className="text-sm text-muted">
								Style options arrive in phase 3.
							</p>
						)}
						{tab === "yaml" && <YamlView widget={widget} />}
					</div>
				</>
			)}
		</aside>
	);
}
