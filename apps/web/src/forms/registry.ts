import type { ComponentType } from "react";
import type { z } from "zod";
import { baseWidgetSchema } from "./schema.ts";

/** The form for one widget type. */
export interface WidgetFormDefinition {
	/** Validates the widget's options; should extend `baseWidgetSchema` and allow unknown keys. */
	readonly schema: z.ZodType;
	/** Widget-specific fields for the Settings tab, shown below the shared ones. */
	readonly Settings?: ComponentType;
	/** Widget-specific fields for the Style tab, shown below the shared ones. */
	readonly Style?: ComponentType;
}

/** Widget type → form. Types that aren't listed get only the shared fields. */
const FORMS: Readonly<Record<string, WidgetFormDefinition>> = {};

/**
 * Looks up the form for a widget type.
 * @param type - The widget's `type`, or `null` when it has none.
 * @returns The form, or `null` when there is no form for this type yet.
 */
export function formFor(type: string | null): WidgetFormDefinition | null {
	// `Object.hasOwn` so a type like "constructor" can't hit Object.prototype.
	return type !== null && Object.hasOwn(FORMS, type)
		? (FORMS[type] ?? null)
		: null;
}

/**
 * The schema used to validate a widget type's fields.
 * @param type - The widget's `type`.
 * @returns The type's own schema, or the shared one for types without a form.
 */
export function schemaFor(type: string | null): z.ZodType {
	return formFor(type)?.schema ?? baseWidgetSchema;
}
