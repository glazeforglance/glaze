/*
 * The texts of the schemas (labels, help, enum labels, …) as translation
 * keys. `pnpm schemas` writes them to apps/web/src/locales/en/fields.json with
 * `schemaTexts`; the web app reads them back with `localizeFields` and
 * `localizeWidget`. Both walk the schemas the same way, so the keys always
 * match. Only erasable TypeScript here, because the generator runs on plain Node.
 *
 * Key layout (nested JSON, `.` between levels):
 *   base.<key>.label                      a widgetBase field
 *   page.<key>…  config.<key>…            page and config fields
 *   widget.<type>.name / .description     a widget type
 *   widget.<type>.groups.<id>             a form section
 *   widget.<type>.fields.<key>.label      a widget field
 * and inside a field: label, help, placeholder, warning, keyLabel,
 * options.<value>.label/help, fields.<key>…, item…, variants.<index>….
 * Children sit under `fields`/`item`/`variants`, so a Glance option named
 * `label` or `options` can't collide with a text.
 */
import type { EnumOption, FieldSchema, WidgetSchema } from "./types.ts";

/** A nested object of texts, the shape of an i18next JSON v4 file. */
export interface TextTree {
	[key: string]: string | TextTree;
}

/**
 * Looks up a translation.
 * @param key - Full key, e.g. `widget.weather.fields.location.label`.
 * @param fallback - The English text from the schema.
 * @returns The translated text, or `fallback`.
 */
export type Translate = (key: string, fallback: string) => string;

/** The texts of one field that people see. `hidden` is a note for developers. */
const FIELD_TEXTS = [
	"label",
	"help",
	"placeholder",
	"warning",
	"keyLabel",
] as const;

// i18next splits keys on "." and ":"; a Glance key with either would break the lookup.
const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

function segment(text: string, where: string): string {
	if (!SAFE_SEGMENT.test(text)) {
		throw new Error(`Can't use "${text}" in a translation key (${where})`);
	}
	return text;
}

/**
 * The name of one item of a list, for "Site 2" and "Add Site": the item's own
 * label, or the list's label made singular ("Sites" → "Site"). It is a text
 * of its own in fields.json, so languages without an English plural rule
 * get it right too.
 * @param field - A `list` field.
 * @returns The item name, starting with a capital.
 */
export function listItemLabel(field: FieldSchema): string {
	if (field.item?.label) return field.item.label;
	const word = field.label;
	const singular = word.endsWith("ies")
		? `${word.slice(0, -3)}y`
		: word.endsWith("s") && !word.endsWith("ss")
			? word.slice(0, -1)
			: word;
	return singular.charAt(0).toUpperCase() + singular.slice(1);
}

function optionTree(options: readonly EnumOption[], where: string): TextTree {
	const tree: TextTree = {};
	for (const option of options) {
		const texts: TextTree = {};
		if (option.label) texts.label = option.label;
		if (option.help) texts.help = option.help;
		if (Object.keys(texts).length > 0) {
			tree[segment(option.value, where)] = texts;
		}
	}
	return tree;
}

function fieldTree(field: FieldSchema, where: string): TextTree {
	const tree: TextTree = {};
	for (const name of FIELD_TEXTS) {
		const text = field[name];
		if (text) tree[name] = text;
	}
	const options = optionTree(field.options ?? [], where);
	if (Object.keys(options).length > 0) tree.options = options;
	const fields = fieldsTree(field.fields ?? [], `${where}.fields`);
	if (Object.keys(fields).length > 0) tree.fields = fields;
	if (field.item) {
		const item = fieldTree(
			field.kind === "list"
				? { ...field.item, label: listItemLabel(field) }
				: field.item,
			`${where}.item`,
		);
		if (Object.keys(item).length > 0) tree.item = item;
	}
	const variants: TextTree = {};
	(field.variants ?? []).forEach((variant, index) => {
		const texts = fieldTree(variant, `${where}.variants.${index}`);
		if (Object.keys(texts).length > 0) variants[String(index)] = texts;
	});
	if (Object.keys(variants).length > 0) tree.variants = variants;
	return tree;
}

function fieldsTree(fields: readonly FieldSchema[], where: string): TextTree {
	const tree: TextTree = {};
	for (const field of fields) {
		const texts = fieldTree(field, `${where}.${field.key}`);
		if (Object.keys(texts).length > 0) tree[segment(field.key, where)] = texts;
	}
	return tree;
}

/**
 * Collects every text of the schemas into one tree, for `fields.json`.
 * @param set - The widget schemas and the base, page and config fields.
 * @returns The texts, keyed as described at the top of this file.
 */
export function schemaTexts(set: {
	readonly base: readonly FieldSchema[];
	readonly widgets: readonly WidgetSchema[];
	readonly page: readonly FieldSchema[];
	readonly config: readonly FieldSchema[];
}): TextTree {
	const widgets: TextTree = {};
	for (const schema of set.widgets) {
		const where = `widget.${schema.type}`;
		const tree: TextTree = { name: schema.label };
		if (schema.description) tree.description = schema.description;
		if (schema.groups.length > 0) {
			tree.groups = Object.fromEntries(
				schema.groups.map((group) => [segment(group.id, where), group.label]),
			);
		}
		const fields = fieldsTree(schema.fields, `${where}.fields`);
		if (Object.keys(fields).length > 0) tree.fields = fields;
		widgets[segment(schema.type, "widget")] = tree;
	}
	return {
		base: fieldsTree(set.base, "base"),
		page: fieldsTree(set.page, "page"),
		config: fieldsTree(set.config, "config"),
		widget: widgets,
	};
}

function localizeOptions(
	options: readonly EnumOption[],
	prefix: string,
	translate: Translate,
): EnumOption[] {
	return options.map((option) => {
		const key = `${prefix}.options.${option.value}`;
		return {
			...option,
			...(option.label
				? { label: translate(`${key}.label`, option.label) }
				: {}),
			...(option.help ? { help: translate(`${key}.help`, option.help) } : {}),
		};
	});
}

function localizeField(
	field: FieldSchema,
	prefix: string,
	translate: Translate,
): FieldSchema {
	const texts: Partial<Record<(typeof FIELD_TEXTS)[number], string>> = {};
	for (const name of FIELD_TEXTS) {
		const text = field[name];
		if (text) texts[name] = translate(`${prefix}.${name}`, text);
	}
	return {
		...field,
		...texts,
		...(field.options
			? { options: localizeOptions(field.options, prefix, translate) }
			: {}),
		...(field.fields
			? {
					fields: localizeFields(field.fields, `${prefix}.fields`, translate),
				}
			: {}),
		// A list's item always gets a name (see `listItemLabel`).
		...(field.item
			? {
					item: localizeField(
						field.kind === "list"
							? { ...field.item, label: listItemLabel(field) }
							: field.item,
						`${prefix}.item`,
						translate,
					),
				}
			: {}),
		...(field.variants
			? {
					variants: field.variants.map((variant, index) =>
						localizeField(variant, `${prefix}.variants.${index}`, translate),
					),
				}
			: {}),
	};
}

/**
 * Translates the texts of a list of fields; everything else stays as it is.
 * @param fields - E.g. `PAGE_FIELDS`.
 * @param prefix - Where they live in fields.json: `base`, `page` or `config`.
 * @param translate - Looks a key up, with the English text as fallback.
 * @returns New field objects with translated texts.
 */
export function localizeFields(
	fields: readonly FieldSchema[],
	prefix: string,
	translate: Translate,
): FieldSchema[] {
	return fields.map((field) =>
		localizeField(field, `${prefix}.${field.key}`, translate),
	);
}

/**
 * Translates a widget schema: its name, description, sections and fields.
 * @param schema - The schema from `widgetSchema`.
 * @param translate - Looks a key up, with the English text as fallback.
 * @returns A new schema with translated texts.
 */
export function localizeWidget(
	schema: WidgetSchema,
	translate: Translate,
): WidgetSchema {
	const prefix = `widget.${schema.type}`;
	return {
		...schema,
		label: translate(`${prefix}.name`, schema.label),
		...(schema.description
			? {
					description: translate(`${prefix}.description`, schema.description),
				}
			: {}),
		groups: schema.groups.map((group) => ({
			...group,
			label: translate(`${prefix}.groups.${group.id}`, group.label),
		})),
		fields: localizeFields(schema.fields, `${prefix}.fields`, translate),
	};
}
