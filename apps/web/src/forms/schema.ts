import { findEnvReferences } from "@glaze/core";
import { z } from "zod";

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
		const result = schema.safeParse(value);
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
 * Makes a field optional: missing or `""` (a cleared input) are both fine.
 * @param schema - The schema for a filled-in value.
 * @returns The optional schema.
 */
export function optional(schema: z.ZodType) {
	return z.union([z.literal(""), schema]).optional();
}

/** Glance's `durationField`: a whole number and one of s, m, h, d (`^(\d+)(s|m|h|d)$`). */
export const duration = z
	.string()
	.regex(/^\d+(s|m|h|d)$/, "Use a number and a unit: 30s, 5m, 1h or 1d");

/** Options every Glance widget has (`widgetBase` in widget.go). Unknown keys pass through. */
export const baseWidgetSchema = z.looseObject({
	type: z.string(),
	title: optional(z.string()),
	"title-url": optional(orEnv(z.string())),
	cache: optional(orEnv(duration)),
	"hide-header": z.boolean().optional(),
	"css-class": optional(z.string()),
});
