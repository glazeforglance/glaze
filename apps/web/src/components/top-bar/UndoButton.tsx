import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import { UndoIcon } from "../ui/icons.tsx";

/**
 * Undo the last change. Arrives together with undo history later.
 * @returns The button.
 */
export function UndoButton() {
	const { t } = useTranslation();
	return (
		<Button
			aria-label={t("topBar.undo")}
			unavailable={t("topBar.comingSoon")}
			className="w-11 px-0"
		>
			<UndoIcon />
		</Button>
	);
}
