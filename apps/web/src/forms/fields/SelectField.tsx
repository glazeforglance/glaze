import { useId } from "react";
import { useWidgetField } from "../use-widget-form.ts";
import {
	borderClass,
	describedBy,
	displayText,
	INPUT_CLASS,
} from "./field-styles.ts";
import { FieldShell } from "./FieldShell.tsx";

/** One choice in a select. */
export interface SelectOption {
	readonly value: string;
	readonly label: string;
}

export interface SelectFieldProps {
	readonly name: string;
	readonly label: string;
	readonly options: readonly SelectOption[];
	/** Label of the empty choice, which removes the key (Glance's default applies). */
	readonly defaultLabel?: string;
	readonly hint?: string;
}

/**
 * A dropdown. Writes as soon as a choice is made. A value from the file that
 * isn't one of the options is still shown, so nothing is hidden or lost.
 * @param props - Field name, label and choices.
 * @returns The field element.
 */
export function SelectField({
	name,
	label,
	options,
	defaultLabel = "Default",
	hint,
}: SelectFieldProps) {
	const id = useId();
	const widgetField = useWidgetField(name);
	const { field, error, disabled } = widgetField;
	const value = displayText(field.value);
	const known =
		value === "" || options.some((option) => option.value === value);

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
				ref={(element) => field.ref(element)}
				name={name}
				value={value}
				disabled={disabled}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy(id, error)}
				onChange={(event) => {
					field.onChange(event.target.value);
					widgetField.commit(event.target.value);
				}}
				onBlur={field.onBlur}
				className={`${INPUT_CLASS} ${borderClass(error !== undefined)} cursor-pointer`}
			>
				<option value="">{defaultLabel}</option>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
				{!known && <option value={value}>{value}</option>}
			</select>
		</FieldShell>
	);
}
