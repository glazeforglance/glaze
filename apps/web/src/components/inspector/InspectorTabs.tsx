import type { KeyboardEvent } from "react";

export type InspectorTab = "settings" | "style" | "yaml";

const TABS: readonly { id: InspectorTab; label: string }[] = [
	{ id: "settings", label: "Settings" },
	{ id: "style", label: "Style" },
	{ id: "yaml", label: "YAML" },
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
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
		const step = event.key === "ArrowRight" ? 1 : -1;
		const index = TABS.findIndex((tab) => tab.id === value);
		const next = TABS[(index + step + TABS.length) % TABS.length];
		if (!next) return;
		onChange(next.id);
		document.getElementById(`inspector-tab-${next.id}`)?.focus();
	};

	return (
		<div
			role="tablist"
			aria-label="Inspector"
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
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}
