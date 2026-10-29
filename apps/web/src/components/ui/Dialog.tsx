import { type ReactNode, useEffect, useId, useRef } from "react";

export interface DialogProps {
	readonly open: boolean;
	readonly title: ReactNode;
	readonly children: ReactNode;
	/** Buttons at the bottom, e.g. Cancel and a confirm button. */
	readonly actions: ReactNode;
	/** Called when the dialog closes itself (Escape) or should close. */
	readonly onClose: () => void;
	/** `wide` for dialogs with lists, e.g. the publish review. */
	readonly size?: "normal" | "wide";
}

/**
 * A modal dialog on the native `<dialog>` element: the browser traps focus,
 * closes it with Escape and puts focus back where it was, without a library.
 * @param props - Open state, title, content and actions.
 * @returns The dialog element.
 */
export function Dialog({
	open,
	title,
	children,
	actions,
	onClose,
	size = "normal",
}: DialogProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useId();

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	return (
		<dialog
			ref={ref}
			aria-labelledby={titleId}
			onClose={onClose}
			className={`m-auto ${size === "wide" ? "w-[min(600px,calc(100vw-32px))]" : "w-[min(440px,calc(100vw-32px))]"} rounded-lg border border-line-strong bg-card p-5 text-text shadow-2xl backdrop:bg-black/60`}
		>
			<h2 id={titleId} className="text-lg font-bold">
				{title}
			</h2>
			<div className="mt-2 text-sm text-muted">{children}</div>
			<div className="mt-5 flex justify-end gap-2">{actions}</div>
		</dialog>
	);
}
