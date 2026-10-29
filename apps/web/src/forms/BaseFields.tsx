import { catalogEntry } from "../lib/widget-catalog.ts";
import { DurationField } from "./fields/DurationField.tsx";
import { TextField } from "./fields/TextField.tsx";
import { ToggleField } from "./fields/ToggleField.tsx";
import { useWidgetForm } from "./use-widget-form.ts";
import { WidthField } from "./WidthField.tsx";
import { useTranslation } from "react-i18next";
import { BASE_FIELDS } from "@glaze/schemas";
import { localizedFields } from "../i18n.ts";

/** Label and help of a widgetBase field, in the UI language (from fields.json). */
function baseTexts() {
	const fields = localizedFields(BASE_FIELDS, "base");
	const find = (key: string) => fields.find((field) => field.key === key);
	return {
		label: (key: string) => find(key)?.label ?? key,
		help: (key: string) => find(key)?.help,
	};
}

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
	const { t } = useTranslation();
	const { widget, hiddenBaseFields: hidden, parentType } = useWidgetForm();
	const base = baseTexts();
	return (
		<>
			{!hidden.has("title") && (
				<TextField
					name="title"
					label={
						parentType === "group"
							? t("forms.base.tabName")
							: base.label("title")
					}
					placeholder={catalogEntry(widget?.type ?? null).label}
				/>
			)}
			{!hidden.has("title-url") && (
				<TextField
					name="title-url"
					label={base.label("title-url")}
					placeholder="https://…"
					hint={base.help("title-url")}
					inputMode="url"
					mono
				/>
			)}
			{!hidden.has("cache") && (
				<DurationField
					name="cache"
					label={base.label("cache")}
					defaultLabel={
						defaultCache
							? t("forms.glanceDefaultValue", { value: defaultCache })
							: t("forms.glanceDefault")
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
	const { t } = useTranslation();
	const { hiddenBaseFields: hidden } = useWidgetForm();
	const base = baseTexts();
	return (
		<>
			<WidthField />
			{!hidden.has("hide-header") && (
				<ToggleField
					name="hide-header"
					label={base.label("hide-header")}
					glanceDefault={false}
				/>
			)}
			{!hidden.has("css-class") && (
				<TextField
					name="css-class"
					label={base.label("css-class")}
					placeholder={t("forms.base.cssPlaceholder")}
					hint={base.help("css-class")}
					mono
				/>
			)}
		</>
	);
}
