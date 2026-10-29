import type { YamlPath } from "@glaze/core";

/**
 * Turns a form field name into a path below the widget.
 * React Hook Form uses dots for nesting, e.g. `sites.2.url` → `["sites", 2, "url"]`.
 * @param name - The field name.
 * @returns The sub-path; digit-only parts become list indexes.
 */
export function toSubPath(name: string): YamlPath {
	return name
		.split(".")
		.map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

/**
 * Turns a path below the widget into a form field name.
 * @param path - E.g. `["sites", 2, "url"]`.
 * @returns E.g. `sites.2.url`.
 */
export function toFieldName(path: YamlPath): string {
	return path.join(".");
}

/**
 * Reads a nested value from plain JS data.
 * @param data - Objects and arrays, e.g. the widget's option values.
 * @param path - Where to read.
 * @returns The value, or `undefined` when any step is missing.
 */
export function valueAt(data: unknown, path: YamlPath): unknown {
	let current = data;
	for (const part of path) {
		if (typeof part === "number") {
			if (!Array.isArray(current)) return undefined;
			current = current[part];
		} else {
			if (typeof current !== "object" || current === null) return undefined;
			if (Array.isArray(current)) return undefined;
			current = (current as Record<string, unknown>)[part];
		}
	}
	return current;
}

/**
 * Deep equality for plain JS values (strings, numbers, booleans, null, arrays, objects).
 * @param a - First value.
 * @param b - Second value.
 * @returns True when both hold the same data.
 */
export function sameValue(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The Glance option a form name points at: its last key, e.g. `url` for
 * `sites.2.url`. List items (`sites.2`) have none of their own.
 * @param name - A form field name.
 * @returns The key, or `null`.
 */
export function optionKeyOf(name: string | undefined): string | null {
	const last = name?.split(".").at(-1);
	return last === undefined || last === "" || /^\d+$/.test(last) ? null : last;
}
