import { isEnvReference } from "./schema.ts";

/**
 * Turns number-field text into the value to write: a number when the text is
 * one, the text itself otherwise (so a `${VAR}` stays, and the schema can
 * report anything else as an error).
 * @param text - What the user typed.
 * @returns A number, `""` for an empty field, or the trimmed text.
 */
export function toNumber(text: string): unknown {
	const trimmed = text.trim();
	if (trimmed === "" || isEnvReference(trimmed)) return trimmed;
	return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed;
}

/**
 * Turns `401, 403` into `[401, 403]` for list-of-number options such as
 * monitor `alt-status-codes`. Parts that aren't numbers stay text, so the
 * schema can point them out.
 * @param text - What the user typed.
 * @returns The list, or `""` for an empty field (which removes the key).
 */
export function toNumberList(text: string): unknown {
	const parts = text.split(/[\s,]+/).filter((part) => part !== "");
	if (parts.length === 0) return "";
	return parts.map((part) => (/^-?\d+$/.test(part) ? Number(part) : part));
}

/**
 * Shows a list of numbers as `401, 403`; text typed so far is returned as is.
 * @param value - The document's value, or the field's text.
 * @returns The text for the input.
 */
export function fromNumberList(value: unknown): string {
	if (Array.isArray(value)) return value.join(", ");
	if (value === undefined || value === null) return "";
	return String(value);
}
