import {
	BASE_FIELDS,
	CONFIG_FIELDS,
	GENERATED_FROM,
	PAGE_FIELDS,
	WIDGET_SCHEMAS,
	WIDGET_TYPES,
} from "./generated/index.ts";
import type { FieldSchema, WidgetSchema } from "./types.ts";

export type {
	FieldOverride,
	Overrides,
	WidgetOverride,
} from "./override-types.ts";
export type {
	CodeLanguage,
	EnumOption,
	FieldGroup,
	FieldKind,
	FieldSchema,
	WidgetSchema,
} from "./types.ts";
export {
	BASE_FIELDS,
	CONFIG_FIELDS,
	GENERATED_FROM,
	PAGE_FIELDS,
	WIDGET_SCHEMAS,
	WIDGET_TYPES,
};

/**
 * Looks up a widget type's schema (aliases like `stocks` included).
 * @param type - The widget's `type`, or `null` when it has none.
 * @returns The schema, or `null` for a type Glance doesn't know.
 */
export function widgetSchema(type: string | null): WidgetSchema | null {
	// `Object.hasOwn` so a type like "constructor" can't hit Object.prototype.
	return type !== null && Object.hasOwn(WIDGET_SCHEMAS, type)
		? (WIDGET_SCHEMAS[type] ?? null)
		: null;
}

/**
 * The option names Glance reads, for the unknown-option check (same shape as
 * `KnownKeys` in @glaze/core): page and column keys, the keys every widget
 * has, and each widget type's own keys (aliases included).
 * @returns The key lists.
 */
export function glanceKeys(): {
	readonly page: readonly string[];
	readonly column: readonly string[];
	readonly widgetBase: readonly string[];
	readonly widgetTypes: Readonly<Record<string, readonly string[]>>;
} {
	const columns = PAGE_FIELDS.find((field) => field.key === "columns");
	return {
		page: PAGE_FIELDS.map((field) => field.key),
		column: columns?.item?.fields?.map((field) => field.key) ?? [],
		widgetBase: BASE_FIELDS.map((field) => field.key),
		widgetTypes: Object.fromEntries(
			Object.entries(WIDGET_SCHEMAS).map(([type, schema]) => [
				type,
				schema.fields.map((field) => field.key),
			]),
		),
	};
}

/**
 * Finds the field a path of keys and indexes points at, e.g.
 * `["sites", 0, "basic-auth", "username"]` in a monitor widget.
 * List indexes step into `item`, map keys into the map's `item`, and object
 * keys into `fields`. Union variants are searched for object keys.
 * @param fields - Where to start, e.g. a widget's fields.
 * @param path - Keys and indexes.
 * @returns The field, or `null` when the path leaves the schema.
 */
export function fieldAt(
	fields: readonly FieldSchema[],
	path: readonly (string | number)[],
): FieldSchema | null {
	const [first, ...rest] = path;
	if (typeof first !== "string") return null;
	let current: FieldSchema | null =
		fields.find((field) => field.key === first) ?? null;
	for (const segment of rest) {
		if (!current) return null;
		current = step(current, segment);
	}
	return current;
}

function step(
	field: FieldSchema,
	segment: string | number,
): FieldSchema | null {
	if (field.kind === "list") {
		return typeof segment === "number" ? (field.item ?? null) : null;
	}
	if (field.kind === "map") {
		return typeof segment === "string" ? (field.item ?? null) : null;
	}
	if (typeof segment !== "string") return null;
	if (field.kind === "object") {
		return field.fields?.find((child) => child.key === segment) ?? null;
	}
	if (field.kind === "union") {
		for (const variant of field.variants ?? []) {
			const found = step(variant, segment);
			if (found) return found;
		}
	}
	return null;
}
