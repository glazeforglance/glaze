import type { KeyboardEvent } from "react";

/** One file tab. */
export interface FileTab {
	readonly id: string;
	readonly label: string;
	readonly dirty: boolean;
}

export interface FileTabsProps {
	readonly tabs: readonly FileTab[];
	readonly active: string;
	readonly onSelect: (id: string) => void;
	/** Id of the element the tabs control. */
	readonly panelId: string;
}

/**
 * The file tabs above the code editor (`glance.yml`, `custom.css`, …).
 * Arrow keys move between tabs, as in the WAI-ARIA tabs pattern.
 * @param props - Tabs, the active one and the select handler.
 * @returns The tab list.
 */
export function FileTabs({ tabs, active, onSelect, panelId }: FileTabsProps) {
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
		const index = tabs.findIndex((tab) => tab.id === active);
		const step = event.key === "ArrowRight" ? 1 : -1;
		const next = tabs[(index + step + tabs.length) % tabs.length];
		if (!next) return;
		event.preventDefault();
		onSelect(next.id);
		document.getElementById(`file-tab-${next.id}`)?.focus();
	};

	return (
		<div
			role="tablist"
			aria-label="Files"
			className="flex min-w-0 items-center gap-1 overflow-x-auto"
			onKeyDown={onKeyDown}
		>
			{tabs.map((tab) => {
				const selected = tab.id === active;
				return (
					<button
						key={tab.id}
						id={`file-tab-${tab.id}`}
						type="button"
						role="tab"
						aria-selected={selected}
						aria-controls={panelId}
						tabIndex={selected ? 0 : -1}
						onClick={() => onSelect(tab.id)}
						className={`inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[6px] px-2.5 font-mono text-xs ${
							selected
								? "border border-line-strong bg-card font-semibold text-text"
								: "border border-transparent text-muted hover:text-text"
						}`}
					>
						{tab.label}
						{tab.dirty && (
							<>
								<span
									aria-hidden="true"
									className="size-1.5 rounded-full bg-accent"
								/>
								<span className="sr-only">(unsaved)</span>
							</>
						)}
					</button>
				);
			})}
		</div>
	);
}
