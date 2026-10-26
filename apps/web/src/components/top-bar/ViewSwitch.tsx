import { VIEWS } from "../../lib/views.ts";
import { useEditor } from "../../store/editor-store.ts";

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
			{VIEWS.map((option, index) => {
				const active = option.id === view;
				const key = String(index + 1);
				return (
					<button
						key={option.id}
						type="button"
						aria-pressed={active}
						aria-keyshortcuts={`Control+${key} Meta+${key}`}
						title={`${option.label} (Ctrl+${key})`}
						onClick={() => setView(option.id)}
						className={`min-h-8 cursor-pointer rounded-[7px] px-3 text-sm ${
							active
								? "bg-card font-semibold text-text"
								: "text-muted hover:text-text"
						}`}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
