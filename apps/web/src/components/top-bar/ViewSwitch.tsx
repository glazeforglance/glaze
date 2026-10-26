import { type EditorView, useEditor } from "../../store/editor-store.ts";

const VIEWS: readonly {
	readonly id: EditorView;
	readonly label: string;
	readonly shortcut: string;
	readonly available: boolean;
}[] = [
	{ id: "design", label: "Design", shortcut: "1", available: true },
	{ id: "code", label: "Code", shortcut: "2", available: true },
	{ id: "preview", label: "Preview", shortcut: "3", available: false },
];

/**
 * Switch between Design, Code and Preview (also Ctrl/Cmd + 1, 2, 3).
 * @returns The segmented control.
 */
export function ViewSwitch() {
	const view = useEditor((state) => state.view);
	const setView = useEditor((state) => state.setView);
	return (
		<div
			role="group"
			aria-label="View"
			className="flex rounded-md border border-line bg-bg p-1"
		>
			{VIEWS.map((option) => {
				const active = option.id === view;
				return (
					<button
						key={option.id}
						type="button"
						aria-pressed={active}
						aria-disabled={option.available ? undefined : true}
						aria-keyshortcuts={`Control+${option.shortcut} Meta+${option.shortcut}`}
						title={
							option.available
								? `${option.label} (Ctrl+${option.shortcut})`
								: "Coming soon"
						}
						onClick={() => option.available && setView(option.id)}
						className={`min-h-8 rounded-[7px] px-3 text-sm ${
							active
								? "bg-card font-semibold text-text"
								: option.available
									? "cursor-pointer text-muted hover:text-text"
									: "cursor-not-allowed text-faint"
						}`}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
