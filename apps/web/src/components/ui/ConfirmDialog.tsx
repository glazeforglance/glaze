import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";

export interface ConfirmDialogProps {
	readonly open: boolean;
	readonly title: ReactNode;
	readonly children: ReactNode;
	/** Text of the destructive button, e.g. "Delete page". */
	readonly confirmLabel: string;
	readonly onConfirm: () => void;
	readonly onCancel: () => void;
}

/**
 * Asks "are you sure?" before a destructive action. Cancel gets focus first,
 * so pressing Enter by accident doesn't delete anything.
 * @param props - Text, and what to do on confirm or cancel.
 * @returns The dialog.
 */
export function ConfirmDialog({
	open,
	title,
	children,
	confirmLabel,
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	const { t } = useTranslation();
	return (
		<Dialog
			open={open}
			title={title}
			onClose={onCancel}
			actions={
				<>
					<Button autoFocus onClick={onCancel}>
						{t("common.cancel")}
					</Button>
					<Button variant="danger" onClick={onConfirm}>
						{confirmLabel}
					</Button>
				</>
			}
		>
			{children}
		</Dialog>
	);
}
