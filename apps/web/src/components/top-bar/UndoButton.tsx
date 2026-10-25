import { Button } from "../ui/Button.tsx";
import { UndoIcon } from "../ui/icons.tsx";

/**
 * Undo the last change. Arrives together with undo history later.
 * @returns The button.
 */
export function UndoButton() {
	return (
		<Button aria-label="Undo" unavailable="Coming soon" className="w-11 px-0">
			<UndoIcon />
		</Button>
	);
}
