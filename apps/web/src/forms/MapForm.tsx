import { getMapOptions, type WidgetOption, type YamlPath } from "@glaze/core";
import type { FieldSchema } from "@glaze/schemas";
import { type ReactNode, useMemo } from "react";
import { type FieldValues, useForm } from "react-hook-form";
import { useEditor } from "../store/editor-store.ts";
import { zodForFields } from "./schema-zod.ts";
import {
	mapTarget,
	optionValues,
	type WidgetFormApi,
	WidgetFormContext,
} from "./use-widget-form.ts";

const NO_OPTIONS: ReadonlyMap<string, WidgetOption> = new Map();

export interface MapFormProps {
	/** The map being edited: a page (`["pages", 0]`) or the document root (`[]`). */
	readonly basePath: YamlPath;
	/** Its fields, for validation (from @glaze/schemas). */
	readonly fields: readonly FieldSchema[];
	readonly children: ReactNode;
}

/**
 * A form for a map that isn't a widget: a page's settings, or the top-level
 * sections of glance.yml. It gives the same field components as the widget
 * forms a target to read and write, so they work here unchanged.
 * @param props - The map's path, its fields and the form content.
 * @returns The form.
 */
export function MapForm({ basePath, fields, children }: MapFormProps) {
	const doc = useEditor((state) => state.doc);
	const key = JSON.stringify(basePath);
	const read = useMemo(
		() => (doc ? getMapOptions(doc, basePath) : null),
		// The path's text is its identity; a new array with the same path is the same map.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[doc, key],
	);
	const options = read?.ok ? read.value.options : NO_OPTIONS;
	const values = useMemo(() => optionValues(options), [options]);
	const form = useForm<FieldValues>({ values });
	const schema = useMemo(() => zodForFields(fields), [fields]);
	const target = useMemo(
		() => mapTarget(() => JSON.parse(key) as YamlPath),
		[key],
	);

	const api: WidgetFormApi = {
		widget: null,
		target,
		schema,
		options,
		readOnly: false,
		form,
		parentType: null,
		hiddenBaseFields: new Set(),
	};
	return (
		<WidgetFormContext value={api}>
			<form noValidate onSubmit={(event) => event.preventDefault()}>
				{children}
			</form>
		</WidgetFormContext>
	);
}
