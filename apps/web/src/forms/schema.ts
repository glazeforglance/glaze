import { findEnvReferences } from "@glaze/core";
import { z } from "zod";
import { i18n } from "../i18n.ts";

/**
 * Tells whether a value is exactly one Glance variable, e.g. `${GITHUB_TOKEN}`.
 * @param value - Any field value.
 * @returns True for a string that is a single `${...}` reference.
 */
export function isEnvReference(value: unknown): value is string {
	return (
		typeof value === "string" &&
		findEnvReferences(value).some((match) => match.whole)
	);
}

/**
 * Accepts a `${...}` reference as well as whatever `schema` accepts. Glance
 * replaces variables before it reads the YAML, so `cache: ${CACHE}` is valid.
 * @param schema - The schema for a literal value.
 * @returns A schema that also allows a variable, with `schema`'s own messages.
 */
export function orEnv(schema: z.ZodType) {
	return z.unknown().superRefine((value, ctx) => {
		if (isEnvReference(value)) return;
		forwardIssues(schema, value, ctx);
	});
}

/**
 * Makes a field optional: missing or `""` (a cleared input) are both fine.
 * Not a `z.union`, because a failed union only says "Invalid input"; this
 * keeps the wrapped schema's own message.
 * @param schema - The schema for a filled-in value.
 * @returns The optional schema.
 */
export function optional(schema: z.ZodType) {
	return z
		.unknown()
		.superRefine((value, ctx) => {
			if (value === undefined || value === "") return;
			forwardIssues(schema, value, ctx);
		})
		.optional();
}

/** Checks `value` with `schema` and reports its issues (with their paths) on `ctx`. */
function forwardIssues(
	schema: z.ZodType,
	value: unknown,
	ctx: z.RefinementCtx,
): void {
	const result = schema.safeParse(value);
	if (result.success) return;
	for (const issue of result.error.issues) {
		ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
	}
}

/** Glance's `durationField`: a whole number and one of s, m, h, d (`^(\d+)(s|m|h|d)$`). */
export const duration = z
	.string()
	.regex(/^\d+(s|m|h|d)$/, { error: () => i18n.t("forms.errors.duration") });

/** Options every Glance widget has (`widgetBase` in widget.go). Unknown keys pass through. */
export const baseWidgetSchema = z.looseObject({
	type: z.string(),
	title: optional(z.string()),
	"title-url": optional(orEnv(z.string())),
	cache: optional(orEnv(duration)),
	"hide-header": z.boolean().optional(),
	"css-class": optional(z.string()),
});

/**
 * A text that must be filled in.
 * @param message - Shown when it's empty, e.g. "A site needs a URL" (already translated).
 * @returns The schema.
 */
export function required(message: string) {
	return z.string({ error: message }).trim().min(1, { error: message });
}

/**
 * A web address: `http(s)://…`, or anything with a `${VAR}` in it (Glance
 * fills those in before it reads the URL).
 * @param message - Shown for anything else; by default "Start the address with http://…".
 * @returns The schema.
 */
export function webUrl(message?: string) {
	const error = () => message ?? i18n.t("forms.errors.url");
	return z
		.string({ error })
		.refine(
			(value) =>
				/^https?:\/\/\S+$/.test(value) || findEnvReferences(value).length > 0,
			{ error },
		);
}

/**
 * A whole number, or a `${VAR}`.
 * @param min - Lowest allowed value.
 * @returns The schema.
 */
export function wholeNumber(min?: number) {
	const error = () => i18n.t("forms.errors.wholeNumberPlain");
	const base = z.number({ error }).int({ error });
	return orEnv(
		min === undefined
			? base
			: base.min(min, {
					error: () => i18n.t("forms.errors.minPlain", { min }),
				}),
	);
}

/**
 * One of a fixed set of words, e.g. `12h` / `24h`.
 * @param values - The allowed values.
 * @returns The schema, with a message that lists them.
 */
export function oneOf(values: readonly [string, ...string[]]) {
	return z.enum(values, {
		error: () => i18n.t("forms.errors.oneOf", { values: values.join(", ") }),
	});
}

/**
 * A list option. A key without items (`sites:`) reads as `null`, which is fine.
 * @param item - Schema for one item.
 * @returns The schema.
 */
export function list(item: z.ZodType) {
	return z.array(item).nullable().optional();
}

/** Glance's `hslColorField`: `240 13 95` or `hsl(240, 13%, 95%)`, as in config-fields.go. */
export const hslColor = z
	.string()
	.regex(/^(?:hsla?\()?([\d.]+)(?: |,)+([\d.]+)%?(?: |,)+([\d.]+)%?\)?$/, {
		error: () => i18n.t("forms.errors.color"),
	});

/** A yes/no option. */
export const flag = z
	.boolean({ error: () => i18n.t("forms.errors.booleanPlain") })
	.optional();
