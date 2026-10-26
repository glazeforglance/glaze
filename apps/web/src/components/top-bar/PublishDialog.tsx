import type { PublishError } from "../../lib/api.ts";
import { Button } from "../ui/Button.tsx";
import { Dialog } from "../ui/Dialog.tsx";

export interface PublishDialogProps {
	/** The failure to explain, or `null` when the dialog is closed. */
	readonly error: PublishError | null;
	readonly onOverwrite: (diskVersion: string) => void;
	readonly onReload: () => void;
	readonly onClose: () => void;
}

/**
 * Explains why publishing failed and offers the ways out:
 * - conflict (file changed on disk): Reload (lose local changes) or Overwrite;
 * - invalid (YAML or layout): the list of problems;
 * - network / server: the message; local changes are kept.
 * @param props - The error and the actions.
 * @returns The dialog.
 */
export function PublishDialog({
	error,
	onOverwrite,
	onReload,
	onClose,
}: PublishDialogProps) {
	const close = (
		<Button autoFocus onClick={onClose}>
			{error?.kind === "conflict" ? "Cancel" : "Close"}
		</Button>
	);

	if (error?.kind === "conflict") {
		const diskVersion = error.version;
		return (
			<Dialog
				open
				title="The file changed on disk"
				onClose={onClose}
				actions={
					<>
						{close}
						<Button variant="danger" onClick={onReload}>
							Reload
						</Button>
						<Button
							variant="primary"
							unavailable={
								diskVersion === null ? "The file is missing" : undefined
							}
							onClick={() => diskVersion !== null && onOverwrite(diskVersion)}
						>
							Overwrite
						</Button>
					</>
				}
			>
				<p>
					Someone edited <code className="font-mono">glance.yml</code> since you
					opened it.
				</p>
				<p className="mt-2">
					<strong className="text-text">Reload</strong> loads their version and
					throws away your unpublished changes.{" "}
					<strong className="text-text">Overwrite</strong> replaces their
					version with yours.
				</p>
			</Dialog>
		);
	}

	return (
		<Dialog
			open={error !== null}
			title={
				error?.kind === "invalid"
					? "Glance can't use this config"
					: "Publish failed"
			}
			onClose={onClose}
			actions={close}
		>
			{error?.kind === "invalid" ? (
				<>
					<p>Nothing was written. {error.message}</p>
					{error.issues.length > 0 && (
						<ul className="mt-3 list-disc space-y-1 pl-5 text-text">
							{error.issues
								.filter((issue) => issue.severity === "error")
								.map((issue) => (
									<li key={`${issue.line}-${issue.message}`}>
										{issue.line !== undefined ? `Line ${issue.line}: ` : ""}
										{issue.message}
									</li>
								))}
						</ul>
					)}
				</>
			) : (
				<p>{error?.message}</p>
			)}
		</Dialog>
	);
}
