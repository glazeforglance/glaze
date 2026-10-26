import { useState } from "react";
import { WidgetForm } from "../../forms/WidgetForm.tsx";
import { useScrollMemory } from "../../hooks/use-scroll-memory.ts";
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
	// Widget ids stay the same through option edits (see ids.ts), so an edit
	// keeps the scroll position, and selecting a widget again brings it back.
	const { ref: scrollRef, onScroll } = useScrollMemory<HTMLElement>(
		widget ? `${widget.id}:${tab}` : null,
	);

	return (
		<aside
			ref={scrollRef}
			onScroll={onScroll}
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
						{tab === "yaml" ? (
							<YamlView widget={widget} />
						) : (
							// Keyed by id: a new widget gets a fresh form, an edit keeps this one.
							<WidgetForm
								key={widget.id}
								widget={widget}
								tab={tab}
								onShowYaml={() => setTab("yaml")}
							/>
						)}
					</div>
				</>
			)}
		</aside>
	);
}
