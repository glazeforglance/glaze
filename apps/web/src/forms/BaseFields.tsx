import { catalogEntry } from "../lib/widget-catalog.ts";
import { DurationField } from "./fields/DurationField.tsx";
import { TextField } from "./fields/TextField.tsx";
import { ToggleField } from "./fields/ToggleField.tsx";
import { useWidgetForm } from "./use-widget-form.ts";

/**
 * Settings every widget has (Glance's `widgetBase`): title, title-url, cache.
 * @returns The fields.
 */
export function BaseSettingsFields() {
	const { widget } = useWidgetForm();
	return (
		<>
			<TextField
				name="title"
				label="Title"
				placeholder={catalogEntry(widget.type).label}
			/>
			<TextField
				name="title-url"
				label="Title link"
				placeholder="https://…"
				hint="Opens when the title is clicked."
				inputMode="url"
				mono
			/>
			<DurationField name="cache" label="Refresh" />
		</>
	);
}

/**
 * Style options every widget has: hide-header, css-class.
 * @returns The fields.
 */
export function BaseStyleFields() {
	return (
		<>
			<ToggleField
				name="hide-header"
				label="Hide the header"
				glanceDefault={false}
			/>
			<TextField
				name="css-class"
				label="CSS class"
				placeholder="e.g. my-card"
				hint="Added to the widget, for your own custom CSS."
				mono
			/>
		</>
	);
}
