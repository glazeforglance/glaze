import { useId } from "react";
import { useWidgetField } from "../use-widget-form.ts";
import {
	borderClass,
	describedBy,
	displayText,
	INPUT_CLASS,
} from "./field-styles.ts";
import { FieldShell } from "./FieldShell.tsx";

export interface TextAreaFieldProps {
	readonly name: string;
	readonly label: string;
	readonly placeholder?: string;
	readonly hint?: string;
	readonly mono?: boolean;
}

/**
 * Text over several lines. Writes on blur or Ctrl/Cmd+Enter (Enter adds a
 * line); Escape drops the change.
 * @param props - Field name, label and options.
 * @returns The field element.
 */
export function TextAreaField({
	name,
	label,
	placeholder,
	hint,
	mono = false,
}: TextAreaFieldProps) {
	const id = useId();
	const widgetField = useWidgetField(name);
	const { field, error, disabled } = widgetField;
	const value = displayText(field.value);

	return (
		<FieldShell
			name={name}
			inputId={id}
			label={label}
			status={widgetField.status}
			env={widgetField.env}
			error={error}
			hint={hint}
			readOnly={widgetField.readOnly}
			onOverride={widgetField.override}
		>
			<textarea
				id={id}
				ref={(element) => field.ref(element)}
				name={name}
				value={value}
				rows={4}
				placeholder={placeholder}
				disabled={disabled}
				spellCheck={false}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy(id, error)}
				onChange={(event) => field.onChange(event.target.value)}
				onBlur={() => {
					field.onBlur();
					widgetField.commit(value);
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
						event.preventDefault();
						widgetField.commit(value);
					} else if (event.key === "Escape") {
						event.preventDefault();
						widgetField.cancel();
					}
				}}
				className={`${INPUT_CLASS} ${borderClass(error !== undefined)} min-h-24 resize-y py-2 ${
					mono ? "font-mono text-[13px]" : ""
				}`}
			/>
		</FieldShell>
	);
}
