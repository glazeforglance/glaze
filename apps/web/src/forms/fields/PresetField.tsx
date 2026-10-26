import { useId, useRef, useState } from "react";
import { useWidgetField } from "../use-widget-form.ts";
import { borderClass, describedBy, INPUT_CLASS } from "./field-styles.ts";
import { FieldShell } from "./FieldShell.tsx";
import { useTextInput } from "./use-text-input.ts";

const PRESETS: readonly { value: string; label: string }[] = [
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

const CUSTOM = "custom";

export interface DurationFieldProps {
	readonly name: string;
	readonly label: string;
	readonly hint?: string;
	/** Label of the empty choice, which removes the key. */
	readonly defaultLabel?: string;
}

/**
 * A Glance duration such as `cache: 5m` (the mock's "Verversen"): common
 * values in a dropdown, anything else (or a `${VAR}`) as custom text.
 * @param props - Field name and label.
 * @returns The field element.
 */
export function DurationField({
	name,
	label,
	hint,
	defaultLabel = "Glance default",
}: DurationFieldProps) {
	const id = useId();
	const widgetField = useWidgetField(name);
	const { field, error, disabled } = widgetField;
	const input = useTextInput(widgetField, (text) => text.trim());
	const customInput = useRef<HTMLInputElement | null>(null);
	const isPreset =
		input.value === "" ||
		PRESETS.some((preset) => preset.value === input.value);
	const [customChosen, setCustomChosen] = useState(false);
	const showCustom = customChosen || !isPreset;

	return (
		<FieldShell
			inputId={id}
			label={label}
			status={widgetField.status}
			env={widgetField.env}
			error={error}
			hint={hint}
			readOnly={widgetField.readOnly}
			onOverride={widgetField.override}
		>
			<select
				id={id}
				value={showCustom ? CUSTOM : input.value}
				disabled={disabled}
				aria-describedby={describedBy(id, error)}
				onChange={(event) => {
					const value = event.target.value;
					if (value === CUSTOM) {
						setCustomChosen(true);
						// The input renders after this update; focus it then.
						requestAnimationFrame(() => customInput.current?.focus());
						return;
					}
					setCustomChosen(false);
					field.onChange(value);
					widgetField.commit(value);
				}}
				className={`${INPUT_CLASS} ${borderClass(error !== undefined && !showCustom)} cursor-pointer`}
			>
				<option value="">{defaultLabel}</option>
				{PRESETS.map((preset) => (
					<option key={preset.value} value={preset.value}>
						{preset.label}
					</option>
				))}
				<option value={CUSTOM}>Custom…</option>
			</select>
			{showCustom && (
				<input
					{...input}
					ref={(element) => {
						customInput.current = element;
						field.ref(element);
					}}
					name={name}
					aria-label={`${label} (custom)`}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedBy(id, error)}
					placeholder="e.g. 90s, 2h"
					disabled={disabled}
					autoComplete="off"
					spellCheck={false}
					className={`${INPUT_CLASS} ${borderClass(error !== undefined)} mt-2 font-mono text-[13px]`}
				/>
			)}
		</FieldShell>
	);
}
