import {
	getWidgetOptions,
	type WidgetNode,
	type WidgetOption,
} from "@glaze/core";
import { useMemo } from "react";
import { type FieldValues, useForm } from "react-hook-form";
import { findWidgetByPath } from "../lib/model.ts";
import { selectCurrentPage, useEditor } from "../store/editor-store.ts";
import { BaseSettingsFields, BaseStyleFields } from "./BaseFields.tsx";
import { WidgetTypeContext } from "./custom-fields.ts";
import { FormNotice } from "./FormNotice.tsx";
import { formFor, schemaFor } from "./registry.ts";
import { OtherOptions, SchemaForm } from "./SchemaForm.tsx";
import {
	type BaseFieldKey,
	optionValues,
	type WidgetFormApi,
	WidgetFormContext,
} from "./use-widget-form.ts";

const NO_OPTIONS: ReadonlyMap<string, WidgetOption> = new Map();

export interface WidgetFormProps {
	readonly widget: WidgetNode;
	readonly tab: "settings" | "style";
	/** Switches the inspector to the YAML tab. */
	readonly onShowYaml: () => void;
}

/**
 * The Settings or Style form of the selected widget. The document is the
 * source of truth: the form shows the widget's current options and every
 * committed field is one edit in the store, after which the form refreshes.
 * @param props - The widget, the tab to show and a link to the YAML tab.
 * @returns The form element.
 */
export function WidgetForm({ widget, tab, onShowYaml }: WidgetFormProps) {
	const doc = useEditor((state) => state.doc);
	const page = useEditor(selectCurrentPage);
	const read = useMemo(
		() => (doc ? getWidgetOptions(doc, widget.path) : null),
		[doc, widget.path],
	);
	const options = read?.ok ? read.value.options : NO_OPTIONS;
	const values = useMemo(() => optionValues(options), [options]);
	// `values` keeps the form in step with the document after every edit.
	const form = useForm<FieldValues>({ values });

	if (widget.include !== null) {
		return (
			<FormNotice>
				This widget comes from another file:{" "}
				<code className="font-mono text-text">{widget.include}</code>. Glaze
				can't edit included files yet.
			</FormNotice>
		);
	}
	if (!read) return null;
	if (!read.ok) return <FormNotice>{read.error.message}</FormNotice>;

	const definition = formFor(widget.type);
	const readOnly = read.value.isAlias;
	const parentType = page
		? (findWidgetByPath(page, widget.path.slice(0, -2))?.type ?? null)
		: null;
	const hiddenBaseFields = new Set<BaseFieldKey>(
		definition?.hiddenBaseFields ?? [],
	);
	// Glance forces `hide-header: true` on every tab of a group.
	if (parentType === "group") hiddenBaseFields.add("hide-header");
	const api: WidgetFormApi = {
		widget,
		schema: schemaFor(widget.type),
		options,
		readOnly,
		form,
		parentType,
		hiddenBaseFields,
	};
	const schema = definition?.widget ?? null;

	return (
		<WidgetFormContext value={api}>
			<WidgetTypeContext value={schema?.type ?? null}>
				{readOnly && (
					<FormNotice tone="violet">
						This widget is a YAML alias (
						<code className="font-mono">*name</code>
						): it shows another widget's settings. Edit that widget instead, or
						change this item in the YAML.
					</FormNotice>
				)}
				<form noValidate onSubmit={(event) => event.preventDefault()}>
					<fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
						{tab === "settings" ? (
							<BaseSettingsFields defaultCache={schema?.defaultCache} />
						) : (
							<BaseStyleFields />
						)}
						{schema && <SchemaForm schema={schema} tab={tab} />}
						{tab === "settings" && (
							<OtherOptions schema={schema} onShowYaml={onShowYaml} />
						)}
					</fieldset>
				</form>
			</WidgetTypeContext>
		</WidgetFormContext>
	);
}
