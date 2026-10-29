import { useTranslation } from "react-i18next";
import { VIEWS } from "../../lib/views.ts";
import { useEditor } from "../../store/editor-store.ts";

/**
 * Switch between Design, Code, Preview and Settings (also Ctrl/Cmd + 1–4).
 * @returns The segmented control.
 */
export function ViewSwitch() {
	const { t } = useTranslation();
	const view = useEditor((state) => state.view);
	const setView = useEditor((state) => state.setView);
	return (
		<div
			role="group"
			aria-label={t("views.label")}
			className="flex rounded-md border border-line bg-bg p-1"
		>
			{VIEWS.map((option, index) => {
				const active = option.id === view;
				const key = String(index + 1);
				const label = t(`views.${option.id}`);
				return (
					<button
						key={option.id}
						type="button"
						aria-pressed={active}
						aria-keyshortcuts={`Control+${key} Meta+${key}`}
						title={t("views.shortcut", { view: label, key })}
						onClick={() => setView(option.id)}
						className={`min-h-8 cursor-pointer rounded-[7px] px-3 text-sm ${
							active
								? "bg-card font-semibold text-text"
								: "text-muted hover:text-text"
						}`}
					>
						{label}
					</button>
				);
			})}
		</div>
	);
}
