import { catalogEntry } from "../lib/widget-catalog.ts";
import { DurationField } from "./fields/DurationField.tsx";
import { TextField } from "./fields/TextField.tsx";
import { ToggleField } from "./fields/ToggleField.tsx";
import { useWidgetForm } from "./use-widget-form.ts";
import { WidthField } from "./WidthField.tsx";

/**
 * Settings every widget has (Glance's `widgetBase`): title, title-url, cache.
 * Fields the widget's form hides (see `hiddenBaseFields`) are left out.
 * @param props - How often Glance refreshes this type by default, e.g. `30m`.
 * @returns The fields.
 */
export function BaseSettingsFields({
	defaultCache,
}: {
	readonly defaultCache?: string | undefined;
}) {
	const { widget, hiddenBaseFields: hidden, parentType } = useWidgetForm();
	return (
		<>
			{!hidden.has("title") && (
				<TextField
					name="title"
					label={parentType === "group" ? "Tab name" : "Title"}
					placeholder={catalogEntry(widget?.type ?? null).label}
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
			{!hidden.has("cache") && (
				<DurationField
					name="cache"
					label="Refresh"
					defaultLabel={
						defaultCache ? `Glance default (${defaultCache})` : "Glance default"
					}
				/>
			)}
		</>
	);
}

/**
 * Style options every widget has: its width (through a split-column),
 * hide-header and css-class.
 * @returns The fields.
 */
export function BaseStyleFields() {
	const { hiddenBaseFields: hidden } = useWidgetForm();
	return (
		<>
			<WidthField />
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
