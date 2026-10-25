const VIEWS = [
	{ id: "design", label: "Design", available: true },
	{ id: "code", label: "Code", available: false },
	{ id: "preview", label: "Preview", available: false },
] as const;

/**
 * Switch between Design, Code and Preview. Only Design exists in phase 2.
 * @returns The segmented control.
 */
export function ViewSwitch() {
	return (
		<div
			role="group"
			aria-label="View"
			className="flex rounded-md border border-line bg-bg p-1"
		>
			{VIEWS.map((view) => {
				const active = view.id === "design";
				return (
					<button
						key={view.id}
						type="button"
						aria-pressed={active}
						aria-disabled={view.available ? undefined : true}
						title={view.available ? undefined : "Coming soon"}
						className={`min-h-8 rounded-[7px] px-3 text-sm ${
							active
								? "bg-card font-semibold text-text"
								: "cursor-not-allowed text-faint"
						}`}
					>
						{view.label}
					</button>
				);
			})}
		</div>
	);
}
