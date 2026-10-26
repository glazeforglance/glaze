import type { ReactNode } from "react";

export interface FormNoticeProps {
	readonly tone?: "info" | "violet";
	readonly children: ReactNode;
}

/**
 * A short note above or instead of a form, e.g. for alias or include widgets.
 * @param props - Text and color.
 * @returns The note element.
 */
export function FormNotice({ tone = "info", children }: FormNoticeProps) {
	const colors =
		tone === "info"
			? "border-info/30 bg-info/8"
			: "border-violet/30 bg-violet/8";
	return (
		<div
			className={`mb-4 rounded-md border px-3 py-2.5 text-sm text-muted ${colors}`}
		>
			{children}
		</div>
	);
}
