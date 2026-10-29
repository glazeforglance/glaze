import type { FieldSchema, WidgetSchema } from "@glaze/schemas";
import { z } from "zod";
import {
	baseWidgetSchema,
	duration,
	hslColor,
	isEnvReference,
	oneOf,
	optional,
	orEnv,
} from "./schema.ts";
import { i18n } from "../i18n.ts";

/*
 * Form validation, derived from the generated schemas. It only checks what
 * Glance itself would refuse (types, enums, duration and color formats,
 * required options), so a config Glance accepts never shows an error here.
 * Unknown keys always pass (`looseObject`). Messages are functions, so they
 * are built in the UI language when a value is checked; `label` is the
 * field's translated label (the registry passes a translated schema).
 */

/** Text, also for numbers and booleans: YAML reads `id: 123` as a number, Glance as text. */
const scalarText = (label: string) =>
	z
		.unknown()
		.refine(
			(value) =>
				typeof value === "string" ||
				typeof value === "number" ||
				typeof value === "boolean",
			{ error: () => i18n.t("forms.errors.text", { label }) },
		);

function wholeNumber(label: string, min: number | undefined) {
	let base = z
		.number({ error: () => i18n.t("forms.errors.wholeNumber", { label }) })
		.int({ error: () => i18n.t("forms.errors.wholeNumber", { label }) });
	if (min !== undefined) {
		base = base.min(min, {
			error: () => i18n.t("forms.errors.min", { label, min }),
		});
	}
	return orEnv(base);
}

function decimal(label: string, min: number | undefined) {
	let base = z.number({
		error: () => i18n.t("forms.errors.number", { label }),
	});
	if (min !== undefined) {
		base = base.min(min, {
			error: () => i18n.t("forms.errors.min", { label, min }),
		});
	}
	return orEnv(base);
}

/** One of several forms: valid when any variant accepts the value. */
function anyOf(label: string, variants: readonly z.ZodType[]) {
	return z.unknown().superRefine((value, ctx) => {
		if (isEnvReference(value)) return;
		if (variants.some((variant) => variant.safeParse(value).success)) return;
		ctx.addIssue({
			code: "custom",
			message: i18n.t("forms.errors.variant", { label }),
		});
	});
}

/** A list item or map value has no label of its own; messages use the parent's. */
function childOf(parent: FieldSchema, child: FieldSchema): FieldSchema {
	return child.label ? child : { ...child, label: parent.label };
}

/**
 * The Zod schema for a value of one field (when the value is present).
 * @param field - The field's schema.
 * @returns A Zod schema.
 */
export function zodForValue(field: FieldSchema): z.ZodType {
	const { label } = field;
	switch (field.kind) {
		case "number":
			return decimal(label, field.min);
		case "integer":
			return wholeNumber(label, field.min);
		case "boolean":
			return orEnv(
				z.boolean({ error: () => i18n.t("forms.errors.boolean", { label }) }),
			);
		case "duration":
			return orEnv(duration);
		case "color":
			return orEnv(hslColor);
		case "enum": {
			const values = (field.options ?? []).map((option) => option.value);
			const [first, ...rest] = values;
			if (field.allowCustom || first === undefined) return scalarText(label);
			return orEnv(oneOf([first, ...rest]));
		}
		case "list":
			return z
				.array(
					field.item ? zodForValue(childOf(field, field.item)) : z.unknown(),
					{
						error: () => i18n.t("forms.errors.list", { label }),
					},
				)
				.nullable();
		case "object":
			return zodForFields(field.fields ?? []).nullable();
		case "map":
			return z
				.record(
					z.string(),
					field.item ? zodForValue(childOf(field, field.item)) : z.unknown(),
					{
						error: () => i18n.t("forms.errors.map", { label }),
					},
				)
				.nullable();
		case "union":
			return anyOf(label, (field.variants ?? []).map(zodForValue));
		case "any":
		case "widgets":
			return z.unknown();
		default:
			return scalarText(label);
	}
}

/**
 * The Zod schema for a field as an option: optional unless Glance requires it.
 * @param field - The field's schema.
 * @returns A Zod schema.
 */
export function zodForField(field: FieldSchema): z.ZodType {
	const value = zodForValue(field);
	if (!field.required) return optional(value);
	return z.unknown().superRefine((current, ctx) => {
		if (current === undefined || current === null || current === "") {
			ctx.addIssue({
				code: "custom",
				message: i18n.t("forms.errors.required", { label: field.label }),
			});
			return;
		}
		const result = value.safeParse(current);
		if (result.success) return;
		for (const issue of result.error.issues) {
			ctx.addIssue({
				code: "custom",
				message: issue.message,
				path: issue.path,
			});
		}
	});
}

/**
 * A loose object schema for a set of fields (unknown keys pass).
 * @param fields - The fields.
 * @returns A Zod object schema.
 */
export function zodForFields(fields: readonly FieldSchema[]) {
	return z.looseObject(
		Object.fromEntries(fields.map((field) => [field.key, zodForField(field)])),
	);
}

/**
 * The Zod schema of a whole widget: the shared options plus the type's own.
 * @param schema - The widget type's schema, or `null` for an unknown type.
 * @returns A Zod schema.
 */
export function zodForWidget(schema: WidgetSchema | null): z.ZodType {
	if (!schema) return baseWidgetSchema;
	return baseWidgetSchema.extend(
		Object.fromEntries(
			schema.fields.map((field) => [field.key, zodForField(field)]),
		),
	);
}
