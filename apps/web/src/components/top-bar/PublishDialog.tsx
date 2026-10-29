import type { PublishError } from "../../lib/api.ts";
import { Button } from "../ui/Button.tsx";
import { Dialog } from "../ui/Dialog.tsx";
import { Trans, useTranslation } from "react-i18next";
import { problemText } from "../../lib/messages.ts";

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
	const { t } = useTranslation();
	const close = (
		<Button autoFocus onClick={onClose}>
			{error?.kind === "conflict" ? t("common.cancel") : t("common.close")}
		</Button>
	);

	if (error?.kind === "conflict") {
		const diskVersion = error.version;
		return (
			<Dialog
				open
				title={t("publish.conflict.title")}
				onClose={onClose}
				actions={
					<>
						{close}
						<Button variant="danger" onClick={onReload}>
							{t("publish.conflict.reload")}
						</Button>
						<Button
							variant="primary"
							unavailable={
								diskVersion === null ? t("publish.conflict.missing") : undefined
							}
							onClick={() => diskVersion !== null && onOverwrite(diskVersion)}
						>
							{t("publish.conflict.overwrite")}
						</Button>
					</>
				}
			>
				<p>
					<Trans
						i18nKey="publish.conflict.body"
						components={{ file: <code dir="ltr" className="font-mono" /> }}
					/>
				</p>
				<p className="mt-2">
					<Trans
						i18nKey="publish.conflict.choice"
						components={{ strong: <strong className="text-text" /> }}
					/>
				</p>
			</Dialog>
		);
	}

	return (
		<Dialog
			open={error !== null}
			title={error?.kind === "invalid" ? t("api.invalid") : t("publish.failed")}
			onClose={onClose}
			actions={close}
		>
			{error?.kind === "invalid" ? (
				<>
					<p>{t("publish.nothingWritten", { message: error.message })}</p>
					{error.issues.length > 0 && (
						<ul className="mt-3 list-disc space-y-1 ps-5 text-text">
							{error.issues
								.filter((issue) => issue.severity === "error")
								.map((issue) => (
									<li key={`${issue.line}-${issue.message}`}>
										{issue.line !== undefined
											? `${t("code.line", { line: issue.line })} `
											: ""}
										{problemText(issue)}
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
