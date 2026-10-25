import { Button } from "../ui/Button.tsx";

/**
 * Writes the edited config back to disk. Wired up in step 2d.
 * @returns The button.
 */
export function PublishButton() {
	return (
		<Button variant="primary" unavailable="Coming soon" className="px-4">
			Publish
		</Button>
	);
}
