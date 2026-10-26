/**
 * Reads a text value of a list item for its header, e.g. a site's `title`.
 * @param item - A list item from the form values (often a map).
 * @param key - The key to read; leave out for items that are plain strings.
 * @returns The text, or `null` when it's missing or empty.
 */
export function itemText(item: unknown, key?: string): string | null {
	const value =
		key === undefined
			? item
			: typeof item === "object" && item !== null && !Array.isArray(item)
				? (item as Record<string, unknown>)[key]
				: undefined;
	if (typeof value === "number") return String(value);
	return typeof value === "string" && value.trim() !== "" ? value : null;
}
