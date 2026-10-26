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
