import { PresetField } from "./PresetField.tsx";
import type { SelectOption } from "./SelectField.tsx";
import { i18n } from "../../i18n.ts";

const PRESETS = ["30s", "1m", "5m", "15m", "30m", "1h", "6h", "12h", "1d"];

/** Short choices for a timeout-like duration rather than a refresh interval. */
const SHORT_PRESETS = ["1s", "3s", "5s", "10s", "30s"];

const UNITS = { s: "seconds", m: "minutes", h: "hours", d: "days" } as const;

/** "Every 5 minutes" or "5 seconds" for a duration like `5m`, in the UI language. */
function presetLabel(value: string, every: boolean): string {
	const match = /^(\d+)([smhd])$/.exec(value);
	const unit = match ? UNITS[match[2] as keyof typeof UNITS] : undefined;
	if (!match || !unit) return value;
	const count = Number(match[1]);
	return every
		? i18n.t(`forms.duration.every.${unit}`, { count })
		: i18n.t(`forms.duration.${unit}`, { count });
}

function presets(values: readonly string[], every: boolean): SelectOption[] {
	return values.map((value) => ({ value, label: presetLabel(value, every) }));
}

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
			defaultLabel={props.defaultLabel ?? i18n.t("forms.glanceDefault")}
			presets={
				scale === "short"
					? presets(SHORT_PRESETS, false)
					: presets(PRESETS, true)
			}
			customPlaceholder={i18n.t("forms.duration.placeholder")}
		/>
	);
}
