import { useState } from "react";
import { WidgetForm } from "../../forms/WidgetForm.tsx";
import { useScrollMemory } from "../../hooks/use-scroll-memory.ts";
import { findWidget } from "../../lib/model.ts";
import { selectCurrentPage, useEditor } from "../../store/editor-store.ts";
import { SidePanel } from "../layout/SidePanel.tsx";
import { InspectorHeader } from "./InspectorHeader.tsx";
import { PageSettings } from "./PageSettings.tsx";
import { type InspectorTab, InspectorTabs } from "./InspectorTabs.tsx";
import { YamlView } from "./YamlView.tsx";
import { useTranslation } from "react-i18next";

/**
 * The sidebar at the inline end (right in LTR): details of the selected widget. Resizable (280–560 px)
 * and collapsible.
 * @returns The sidebar element.
 */
export function Inspector() {
	const { t } = useTranslation();
	const page = useEditor(selectCurrentPage);
	const selectedWidgetId = useEditor((state) => state.selectedWidgetId);
	const pageSettingsOpen = useEditor((state) => state.pageSettingsOpen);
	const [tab, setTab] = useState<InspectorTab>("settings");
	const widget =
		page && selectedWidgetId ? findWidget(page, selectedWidgetId) : null;
	// Widget ids stay the same through option edits (see ids.ts), so an edit
	// keeps the scroll position, and selecting a widget again brings it back.
	const { ref: scrollRef, onScroll } = useScrollMemory<HTMLElement>(
		widget ? `${widget.id}:${tab}` : null,
	);

	return (
		<SidePanel
			id="inspector"
			side="end"
			label={t("inspector.panelName")}
			defaultWidth={330}
			min={280}
			max={560}
		>
			<aside
				ref={scrollRef}
				onScroll={onScroll}
				aria-label={t("inspector.label")}
				className="flex min-w-0 flex-1 flex-col overflow-y-auto border-s border-line bg-bg px-5 py-5"
			>
				{widget === null && pageSettingsOpen && page ? (
					<PageSettings page={page} />
				) : widget === null ? (
					<p className="mt-10 text-center text-sm text-muted">
						{t("inspector.empty")}
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
		</SidePanel>
	);
}
