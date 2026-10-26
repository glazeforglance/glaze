import { PresetField } from "./PresetField.tsx";
import type { SelectOption } from "./SelectField.tsx";

const PRESETS: readonly SelectOption[] = [
	{ value: "30s", label: "Every 30 seconds" },
	{ value: "1m", label: "Every minute" },
	{ value: "5m", label: "Every 5 minutes" },
	{ value: "15m", label: "Every 15 minutes" },
	{ value: "30m", label: "Every 30 minutes" },
	{ value: "1h", label: "Every hour" },
	{ value: "6h", label: "Every 6 hours" },
	{ value: "12h", label: "Every 12 hours" },
	{ value: "1d", label: "Every day" },
];

/** Short choices for a timeout-like duration rather than a refresh interval. */
const SHORT_PRESETS: readonly SelectOption[] = [
	{ value: "1s", label: "1 second" },
	{ value: "3s", label: "3 seconds" },
	{ value: "5s", label: "5 seconds" },
	{ value: "10s", label: "10 seconds" },
	{ value: "30s", label: "30 seconds" },
];

export interface DurationFieldProps {
	readonly name: string;
	readonly label: string;
	readonly hint?: string;
	/** Label of the empty choice, which removes the key. */
	readonly defaultLabel?: string;
	/** `short` offers seconds (timeouts) instead of refresh intervals. */
	readonly scale?: "refresh" | "short";
}

/**
 * A Glance duration such as `cache: 5m` (the mock's "Verversen"): common
 * values in a dropdown, anything else (or a `${VAR}`) as custom text.
 * @param props - Field name and label.
 * @returns The field element.
 */
export function DurationField({
	scale = "refresh",
	...props
}: DurationFieldProps) {
	return (
		<PresetField
			{...props}
			presets={scale === "short" ? SHORT_PRESETS : PRESETS}
			customPlaceholder="e.g. 90s, 2h"
		/>
	);
}
