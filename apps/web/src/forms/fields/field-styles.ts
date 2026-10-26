/** Classes shared by text-like inputs and selects (the mock's "Diensten" title box). */
export const INPUT_CLASS =
	"min-h-10 w-full rounded-sm border bg-card px-3 text-sm text-text placeholder:text-faint outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Border color for an input.
 * @param invalid - Whether the field has a validation error.
 * @returns A Tailwind border class.
 */
export function borderClass(invalid: boolean): string {
	return invalid ? "border-danger" : "border-line hover:border-line-strong";
}

/**
 * Ids of a field's hint and error text, for `aria-describedby` (see `FieldShell`).
 * @param inputId - The input's id.
 * @param error - The current error, if any.
 * @returns Space-separated ids.
 */
export function describedBy(inputId: string, error?: string): string {
	return error ? `${inputId}-error ${inputId}-hint` : `${inputId}-hint`;
}

/**
 * Converts a document value to the text shown in an input.
 * @param value - Any option value.
 * @returns The text; empty for a missing value.
 */
export function displayText(value: unknown): string {
	if (value === undefined || value === null) return "";
	return typeof value === "string" ? value : String(value);
}
