import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { currentDirection } from "../../i18n.ts";
import { logicalKey } from "../../lib/direction.ts";

export type InspectorTab = "settings" | "style" | "yaml";

/** The tabs in order; labels are `inspector.tabs.<id>`. */
const TABS: readonly { id: InspectorTab }[] = [
	{ id: "settings" },
	{ id: "style" },
	{ id: "yaml" },
];

export interface InspectorTabsProps {
	readonly value: InspectorTab;
	readonly onChange: (tab: InspectorTab) => void;
}

/**
 * Settings / Style / YAML tabs. Arrow keys move between tabs (WAI-ARIA tabs pattern).
 * @param props - The active tab and change handler.
 * @returns The tab list.
 */
export function InspectorTabs({ value, onChange }: InspectorTabsProps) {
	const { t } = useTranslation();
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const key = logicalKey(event.key, currentDirection());
		if (key !== "ArrowRight" && key !== "ArrowLeft") return;
		const step = key === "ArrowRight" ? 1 : -1;
		const index = TABS.findIndex((tab) => tab.id === value);
		const next = TABS[(index + step + TABS.length) % TABS.length];
		if (!next) return;
		onChange(next.id);
		document.getElementById(`inspector-tab-${next.id}`)?.focus();
	};

	return (
		<div
			role="tablist"
			aria-label={t("inspector.label")}
			onKeyDown={onKeyDown}
			className="flex gap-5 border-b border-line"
		>
			{TABS.map((tab) => {
				const selected = tab.id === value;
				return (
					<button
						key={tab.id}
						id={`inspector-tab-${tab.id}`}
						type="button"
						role="tab"
						aria-selected={selected}
						aria-controls={`inspector-panel-${tab.id}`}
						tabIndex={selected ? 0 : -1}
						onClick={() => onChange(tab.id)}
						className={`-mb-px min-h-9 cursor-pointer border-b-2 text-sm ${
							selected
								? "border-accent font-semibold text-text"
								: "border-transparent text-muted hover:text-text"
						}`}
					>
						{t(`inspector.tabs.${tab.id}`)}
					</button>
				);
			})}
		</div>
	);
}
