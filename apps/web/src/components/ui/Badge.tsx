import type { BadgeTone } from "../../lib/widget-catalog.ts";

const TONES: Record<BadgeTone, string> = {
	accent: "bg-accent/12 text-accent",
	success: "bg-success/12 text-success",
	info: "bg-info/12 text-info",
	violet: "bg-violet/12 text-violet",
};

export interface BadgeProps {
	readonly text: string;
	readonly tone: BadgeTone;
	readonly size?: "sm" | "md";
}

/**
 * The small colored square with a widget's abbreviation (e.g. "MO" for monitor).
 * Decorative: the widget's name is always shown next to it.
 * @param props - Badge text, color and size.
 * @returns The badge element.
 */
export function Badge({ text, tone, size = "md" }: BadgeProps) {
	const box =
		size === "sm" ? "h-6 min-w-6 text-[9px]" : "h-7 min-w-7 text-[10px]";
	return (
		<span
			aria-hidden="true"
			className={`inline-flex shrink-0 items-center justify-center rounded-[6px] px-1 font-mono font-bold ${box} ${TONES[tone]}`}
		>
			{text}
		</span>
	);
}
