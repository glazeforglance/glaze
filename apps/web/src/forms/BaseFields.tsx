import { catalogEntry } from "../lib/widget-catalog.ts";
import { DurationField } from "./fields/DurationField.tsx";
import { TextField } from "./fields/TextField.tsx";
import { ToggleField } from "./fields/ToggleField.tsx";
import { useWidgetForm } from "./use-widget-form.ts";

/**
 * Settings every widget has (Glance's `widgetBase`): title, title-url, cache.
 * Fields the widget's form hides (see `hiddenBaseFields`) are left out.
 * @returns The fields.
 */
export function BaseSettingsFields() {
	const { widget, hiddenBaseFields: hidden, parentType } = useWidgetForm();
	return (
		<>
			{!hidden.has("title") && (
				<TextField
					name="title"
					label={parentType === "group" ? "Tab name" : "Title"}
					placeholder={catalogEntry(widget.type).label}
				/>
			)}
			{!hidden.has("title-url") && (
				<TextField
					name="title-url"
					label="Title link"
					placeholder="https://…"
					hint="Opens when the title is clicked."
					inputMode="url"
					mono
				/>
			)}
			{!hidden.has("cache") && <DurationField name="cache" label="Refresh" />}
		</>
	);
}

/**
 * Style options every widget has: hide-header, css-class.
 * @returns The fields.
 */
export function BaseStyleFields() {
	const { hiddenBaseFields: hidden } = useWidgetForm();
	return (
		<>
			{!hidden.has("hide-header") && (
				<ToggleField
					name="hide-header"
					label="Hide the header"
					glanceDefault={false}
				/>
			)}
			{!hidden.has("css-class") && (
				<TextField
					name="css-class"
					label="CSS class"
					placeholder="e.g. my-card"
					hint="Added to the widget, for your own custom CSS."
					mono
				/>
			)}
		</>
	);
}
