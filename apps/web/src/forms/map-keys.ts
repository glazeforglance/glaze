/**
 * Tells whether a map key can be edited through the form. Field names use
 * dots for nesting and digit-only parts for list indexes, so keys like
 * `my.app` or `123` can only be edited in the YAML tab.
 * @param key - A key of a map option, e.g. a container name.
 * @returns True when the form can address it.
 */
export function isFormSafeKey(key: string): boolean {
	return key !== "" && !key.includes(".") && !/^\d+$/.test(key);
}

/**
 * Checks a new key for a map option before it's written.
 * @param key - The key the user typed, e.g. a container name.
 * @param existing - Keys the map already has.
 * @returns A message for the user, or `null` when the key is fine.
 */
export function checkNewMapKey(
	key: string,
	existing: readonly string[],
): string | null {
	const trimmed = key.trim();
	if (trimmed === "") return "Enter a name first.";
	if (existing.includes(trimmed)) return `"${trimmed}" is already in the list.`;
	if (!isFormSafeKey(trimmed)) {
		return "Names with dots or only digits can be added in the YAML tab.";
	}
	return null;
}
