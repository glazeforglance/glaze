import { WIDGET_TYPES, type WidgetSchema, widgetSchema } from "@glaze/schemas";
import type { z } from "zod";
import { zodForWidget } from "./schema-zod.ts";
import type { BaseFieldKey } from "./use-widget-form.ts";

/** The form of one widget type: generated from its schema. */
export interface WidgetFormDefinition {
	readonly widget: WidgetSchema;
	/** Validates the widget's options (unknown keys always pass). */
	readonly schema: z.ZodType;
	/** Shared fields that Glance ignores for this type (e.g. a group's title). */
	readonly hiddenBaseFields?: readonly BaseFieldKey[];
}

// Glance hides the header of these containers (widget-group.go, widget-split-column.go),
// so their title, title link, refresh and header switch have no effect.
const NO_HEADER: readonly BaseFieldKey[] = [
	"title",
	"title-url",
	"cache",
	"hide-header",
];
const HIDDEN_BASE: Readonly<Record<string, readonly BaseFieldKey[]>> = {
	group: NO_HEADER,
	"split-column": NO_HEADER,
};

/** Every widget type that has a form: all of Glance's (aliases not included). */
export const FORM_TYPES: readonly string[] = WIDGET_TYPES;

const CACHE = new Map<string, WidgetFormDefinition>();

/**
 * Looks up the form for a widget type.
 * @param type - The widget's `type`, or `null` when it has none.
 * @returns The form, or `null` for a type Glance doesn't know.
 */
export function formFor(type: string | null): WidgetFormDefinition | null {
	const widget = widgetSchema(type);
	if (!widget || type === null) return null;
	const cached = CACHE.get(type);
	if (cached) return cached;
	const hidden = HIDDEN_BASE[widget.type];
	const definition: WidgetFormDefinition = {
		widget,
		schema: zodForWidget(widget),
		...(hidden ? { hiddenBaseFields: hidden } : {}),
	};
	CACHE.set(type, definition);
	return definition;
}

/**
 * The schema used to validate a widget type's fields.
 * @param type - The widget's `type`.
 * @returns The type's schema, or the shared one for types Glance doesn't know.
 */
export function schemaFor(type: string | null): z.ZodType {
	return formFor(type)?.schema ?? zodForWidget(null);
}
