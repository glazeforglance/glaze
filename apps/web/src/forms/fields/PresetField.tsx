import { useId, useRef, useState } from "react";
import { useWidgetField } from "../use-widget-form.ts";
import { borderClass, describedBy, INPUT_CLASS } from "./field-styles.ts";
import { FieldShell } from "./FieldShell.tsx";
import type { SelectOption } from "./SelectField.tsx";
import { useTextInput } from "./use-text-input.ts";

// Not a valid value for any Glance option, so it can't clash with a preset.
const CUSTOM = "__custom__";

export interface PresetFieldProps {
	readonly name: string;
	readonly label: string;
	/** The common values, shown in the dropdown. */
	readonly presets: readonly SelectOption[];
	readonly hint?: string;
	/** Label of the empty choice, which removes the key. */
	readonly defaultLabel?: string;
	readonly customPlaceholder?: string;
}

/**
 * A text option with common values in a dropdown and "Custom…" for anything
 * else (or a `${VAR}`), e.g. `cache: 5m` or a search engine.
 * @param props - Field name, label and the common values.
 * @returns The field element.
 */
export function PresetField({
	name,
	label,
	presets,
	hint,
	defaultLabel = "Glance default",
	customPlaceholder,
}: PresetFieldProps) {
	const id = useId();
	const widgetField = useWidgetField(name);
	const { field, error, disabled } = widgetField;
	const input = useTextInput(widgetField, (text) => text.trim());
	const customInput = useRef<HTMLInputElement | null>(null);
	const isPreset =
		input.value === "" ||
		presets.some((preset) => preset.value === input.value);
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
				{presets.map((preset) => (
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
					placeholder={customPlaceholder}
					disabled={disabled}
					autoComplete="off"
					spellCheck={false}
					className={`${INPUT_CLASS} ${borderClass(error !== undefined)} mt-2 font-mono text-[13px]`}
				/>
			)}
		</FieldShell>
	);
}
