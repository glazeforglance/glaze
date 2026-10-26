import type { YamlPath } from "@glaze/core";
import type { z } from "zod";
import { sameValue } from "./paths.ts";

/** Returns a copy of `data` with `value` at `path`, creating objects and arrays on the way. */
function setAt(data: unknown, path: YamlPath, value: unknown): unknown {
	const [head, ...rest] = path;
	if (head === undefined) return value;
	if (typeof head === "number") {
		const list = Array.isArray(data) ? [...data] : [];
		list[head] = setAt(list[head], rest, value);
		return list;
	}
	const record =
		typeof data === "object" && data !== null && !Array.isArray(data)
			? { ...(data as Record<string, unknown>) }
			: {};
	record[head] = setAt(record[head], rest, value);
	return record;
}

/**
 * Validates one field the way the whole widget would be validated, but only
 * reports problems at that field, so other (e.g. hand-written) values never
 * block it.
 * @param schema - The widget's schema.
 * @param values - The widget's current option values.
 * @param path - The field, e.g. `["sites", 2, "url"]`.
 * @param value - The new value for that field.
 * @returns The first error message for the field, or `null` when it's valid.
 */
export function validateField(
	schema: z.ZodType,
	values: unknown,
	path: YamlPath,
	value: unknown,
): string | null {
	const result = schema.safeParse(setAt(values, path, value));
	if (result.success) return null;
	const issue = result.error.issues.find((candidate) =>
		sameValue(candidate.path.slice(0, path.length), path),
	);
	return issue?.message ?? null;
}
