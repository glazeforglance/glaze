import type { FieldSchema } from "@glaze/schemas";

/*
 * Pure helpers for the schema-driven fields: icons, unions, "any" values
 * and list item titles.
 */

/** The icon sources Glance knows, plus a plain URL. */
export type IconSource = "si" | "di" | "sh" | "mdi" | "url";

/** An icon value split into its parts. */
export interface IconParts {
	readonly source: IconSource;
	/** The icon name (e.g. `jellyfin`, `jellyfin.png`) or the URL. */
	readonly name: string;
	/** Glance's `auto-invert ` prefix: invert the icon on light themes. */
	readonly autoInvert: boolean;
}

const ICON_PREFIXES: readonly IconSource[] = ["si", "di", "sh", "mdi"];
const AUTO_INVERT = "auto-invert ";

/**
 * Splits a Glance icon value, as Glance reads it (`newCustomIconField`).
 * @param value - E.g. `si:jellyfin`, `auto-invert di:immich.png` or a URL.
 * @returns The parts.
 */
export function parseIcon(value: string): IconParts {
	let rest = value;
	const autoInvert = rest.startsWith(AUTO_INVERT);
	if (autoInvert) rest = rest.slice(AUTO_INVERT.length);
	const colon = rest.indexOf(":");
	const prefix = colon === -1 ? "" : rest.slice(0, colon);
	const source = ICON_PREFIXES.find((candidate) => candidate === prefix);
	return source
		? { source, name: rest.slice(colon + 1), autoInvert }
		: { source: "url", name: rest, autoInvert };
}

/**
 * Joins icon parts into a Glance icon value.
 * @param parts - The parts.
 * @returns The value, or `""` when there is no name.
 */
export function formatIcon(parts: IconParts): string {
	if (parts.name.trim() === "") return "";
	const body =
		parts.source === "url"
			? parts.name.trim()
			: `${parts.source}:${parts.name.trim()}`;
	return parts.autoInvert ? `${AUTO_INVERT}${body}` : body;
}

/** The shape of a YAML value. */
export type ValueShape =
	| "text"
	| "number"
	| "boolean"
	| "list"
	| "map"
	| "empty";

/**
 * Tells what shape a value has.
 * @param value - Any value from the document.
 * @returns Its shape.
 */
export function shapeOf(value: unknown): ValueShape {
	if (value === null || value === undefined) return "empty";
	if (Array.isArray(value)) return "list";
	if (typeof value === "object") return "map";
	if (typeof value === "number") return "number";
	if (typeof value === "boolean") return "boolean";
	return "text";
}

/**
 * Converts a value to another shape, keeping what can be kept (used when the
 * type select of an "any" value changes).
 * @param value - The current value.
 * @param shape - The wanted shape.
 * @returns The converted value.
 */
export function convertShape(value: unknown, shape: ValueShape): unknown {
	const current = shapeOf(value);
	if (current === shape) return value;
	const text =
		current === "text" || current === "number" || current === "boolean"
			? String(value)
			: "";
	switch (shape) {
		case "text":
			return text;
		case "number": {
			const number = Number(text);
			return text !== "" && Number.isFinite(number) ? number : 0;
		}
		case "boolean":
			return text === "true";
		case "list":
			return text === "" ? [] : [value];
		case "map":
			return {};
		default:
			return null;
	}
}

/**
 * Picks the union variant that matches a value: a string for the plain
 * variant, an object for the object variant, a list for the list variant.
 * @param field - The union field.
 * @param value - Its current value.
 * @returns The index of the matching variant (0 when nothing matches).
 */
export function variantIndex(field: FieldSchema, value: unknown): number {
	const shape = shapeOf(value);
	const variants = field.variants ?? [];
	const index = variants.findIndex((variant) => {
		if (shape === "map") return variant.kind === "object";
		if (shape === "list") return variant.kind === "list";
		return variant.kind !== "object" && variant.kind !== "list";
	});
	return index === -1 ? 0 : index;
}

/**
 * Converts a union value to another variant. A plain value becomes the
 * object variant's first field (e.g. `owner/repo` → `{ repository: … }`)
 * and back; a list keeps its first item when it becomes plain.
 * @param field - The union field.
 * @param value - The current value.
 * @param to - The index of the wanted variant.
 * @returns The value in the new variant's form, or `null` when it starts empty.
 */
export function convertVariant(
	field: FieldSchema,
	value: unknown,
	to: number,
): unknown {
	const target = field.variants?.[to];
	if (!target) return value;
	const shape = shapeOf(value);
	const plain =
		shape === "map"
			? firstText(value as Record<string, unknown>, target)
			: shape === "list"
				? (value as unknown[])[0]
				: value;
	if (target.kind === "object") {
		const key = mainKey(target);
		if (shape === "map") return value;
		return key && plain !== undefined && plain !== null && plain !== ""
			? { [key]: plain }
			: null;
	}
	if (target.kind === "list") {
		if (shape === "list") return value;
		return plain === undefined || plain === null || plain === "" ? [] : [plain];
	}
	return plain ?? null;
}

/** The object field that holds the "plain" form of a union, e.g. `repository` or `url`. */
function mainKey(target: FieldSchema): string | null {
	const fields = target.fields ?? [];
	return (
		fields.find((field) => field.required)?.key ??
		fields.find((field) => field.key === "url" || field.key === "repository")
			?.key ??
		fields[0]?.key ??
		null
	);
}

function firstText(
	map: Record<string, unknown>,
	_target: FieldSchema,
): unknown {
	for (const key of ["repository", "url"]) {
		if (typeof map[key] === "string") return map[key];
	}
	return Object.values(map).find((entry) => typeof entry === "string");
}

const TITLE_KEYS = [
	"title",
	"name",
	"label",
	"symbol",
	"repository",
	"timezone",
	"shortcut",
	"url",
	"type",
];

/**
 * A short name for a list item, for its card header.
 * @param item - The item's value.
 * @param fallback - Used when the item has no name, e.g. "Site 2".
 * @returns The name.
 */
export function itemName(item: unknown, fallback: string): string {
	if (typeof item === "string" || typeof item === "number") return String(item);
	if (typeof item !== "object" || item === null || Array.isArray(item))
		return fallback;
	const record = item as Record<string, unknown>;
	for (const key of TITLE_KEYS) {
		const value = record[key];
		if (typeof value === "string" && value.trim() !== "") return value;
	}
	return fallback;
}

/**
 * The value a new list item or map entry starts with: never empty, because
 * YAML writes an empty map as `{}` and an empty string as `""`.
 * @param field - The item's schema.
 * @returns A value that is valid for Glance, or as close as possible.
 */
export function newValue(field: FieldSchema): unknown {
	switch (field.kind) {
		case "object": {
			const fields = field.fields ?? [];
			const first =
				fields.find((child) => child.required) ??
				fields.find(
					(child) =>
						child.kind !== "object" &&
						child.kind !== "list" &&
						child.kind !== "map",
				);
			return first ? { [first.key]: newValue(first) } : null;
		}
		case "list":
			return [];
		case "map":
			return null;
		case "union":
			return field.variants?.[0] ? newValue(field.variants[0]) : "";
		case "boolean":
			return field.default === true;
		case "integer":
		case "number":
			return typeof field.default === "number" ? field.default : 0;
		case "enum":
			return field.default ?? field.options?.[0]?.value ?? "";
		case "url":
			return field.placeholder ?? "https://example.com";
		default:
			return typeof field.default === "string" && field.default !== ""
				? field.default
				: (field.placeholder ?? "change-me");
	}
}
