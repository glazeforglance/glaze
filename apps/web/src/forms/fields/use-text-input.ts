import type { ChangeEvent, KeyboardEvent } from "react";
import type { WidgetField } from "../use-widget-form.ts";
import { displayText } from "./field-styles.ts";

/** Props to spread on an `<input>`. */
export interface TextInputProps {
	readonly value: string;
	onChange(event: ChangeEvent<HTMLInputElement>): void;
	onBlur(): void;
	onKeyDown(event: KeyboardEvent<HTMLInputElement>): void;
}

/**
 * Text-input behaviour shared by every text-like field: keystrokes only change
 * the form; blur or Enter writes to the document; Escape drops the change.
 * @param widgetField - From `useWidgetField`.
 * @param parse - Turns the text into the value to write.
 * @param format - Turns the document's value into text. It also gets the text
 *   typed so far (a string), which it should return unchanged.
 * @returns Props for the input.
 */
export function useTextInput(
	widgetField: WidgetField,
	parse: (text: string) => unknown = (text) => text,
	format: (value: unknown) => string = displayText,
): TextInputProps {
	const { field } = widgetField;
	const value = format(field.value);
	return {
		value,
		onChange: (event) => field.onChange(event.target.value),
		onBlur: () => {
			field.onBlur();
			widgetField.commit(parse(value));
		},
		onKeyDown: (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				widgetField.commit(parse(value));
			} else if (event.key === "Escape") {
				event.preventDefault();
				widgetField.cancel();
			}
		},
	};
}
