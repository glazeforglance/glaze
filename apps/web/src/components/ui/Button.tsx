import type { ButtonHTMLAttributes, MouseEvent } from "react";

type Variant = "primary" | "secondary" | "ghost" | "dashed" | "danger";

const VARIANTS: Record<Variant, string> = {
	primary:
		"bg-accent text-accent-ink font-semibold hover:brightness-110 border border-accent",
	secondary:
		"bg-card text-text border border-line hover:border-line-strong hover:bg-card-hover",
	ghost: "text-muted hover:text-text hover:bg-card",
	danger:
		"bg-danger/15 text-danger font-semibold border border-danger/50 hover:bg-danger/25",
	dashed:
		"text-muted border border-dashed border-line-strong hover:text-text hover:border-faint w-full",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	readonly variant?: Variant;
	/**
	 * When set, the button is shown but does nothing, and this text explains why
	 * (as a tooltip). Uses `aria-disabled` instead of `disabled`, because browsers
	 * don't show tooltips on disabled buttons.
	 */
	readonly unavailable?: string;
}

/**
 * A button in one of the editor's styles.
 * @param props - Normal button props plus `variant` and `unavailable`.
 * @returns The button element.
 */
export function Button({
	variant = "secondary",
	unavailable,
	className = "",
	onClick,
	type = "button",
	...rest
}: ButtonProps) {
	const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
		if (unavailable) return;
		onClick?.(event);
	};
	return (
		<button
			{...rest}
			type={type}
			aria-disabled={unavailable ? true : undefined}
			title={unavailable ?? rest.title}
			onClick={handleClick}
			className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-sm px-3.5 text-sm transition-colors ${VARIANTS[variant]} ${unavailable ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${className}`}
		/>
	);
}
