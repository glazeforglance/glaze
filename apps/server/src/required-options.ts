import {
	type GlazeDocument,
	getModel,
	getWidgetOptions,
	type WidgetNode,
	type YamlPath,
} from "@glaze/core";
import { type FieldSchema, widgetSchema } from "@glaze/schemas";

/** An option Glance requires that a widget doesn't set. */
export interface MissingOption {
	/** The map that should hold the option (the widget or a list item). */
	readonly path: YamlPath;
	/** E.g. "Weather needs a location" (English; the web app builds its own from `params`). */
	readonly message: string;
	/**
	 * fields.json keys for the web app's sentence: `widget` (e.g.
	 * `widget.weather`), `option` (e.g. `widget.weather.fields.location`) and,
	 * inside a list, `list` and the 1-based `item` of the innermost list.
	 */
	readonly params: Readonly<Record<string, string | number>>;
}

/** The innermost list item an option is missing in, for "… for site 2". */
interface ListItem {
	readonly list: string;
	readonly item: number;
}

/** What `check` carries down into nested objects. */
interface Context {
	readonly path: YamlPath;
	readonly trail: readonly string[];
	/** fields.json key prefix of the fields being checked. */
	readonly textKey: string;
	readonly listItem: ListItem | null;
}

function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || value === "";
}

/** "Location" → "a location", "URL" → "a URL" (all-caps words keep their case). */
function withArticle(label: string): string {
	const words = label
		.split(" ")
		.map((word) => (word === word.toUpperCase() ? word : word.toLowerCase()));
	const text = words.join(" ");
	return /^[aeio]/i.test(text) ? `an ${text}` : `a ${text}`;
}

/** "Sites" → "site", for "site 2". */
function singular(label: string): string {
	const word = label.toLowerCase();
	if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
	return word.endsWith("s") ? word.slice(0, -1) : word;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

/**
 * The object form of a field's value: its own fields, or a union's object
 * variant, plus the fields.json key prefix of those fields.
 */
function objectFields(
	field: FieldSchema,
	value: unknown,
	textKey: string,
): { fields: readonly FieldSchema[]; textKey: string } | null {
	if (!asRecord(value)) return null;
	if (field.kind === "object" && field.fields) {
		return { fields: field.fields, textKey: `${textKey}.fields` };
	}
	if (field.kind === "union") {
		const index =
			field.variants?.findIndex((variant) => variant.kind === "object") ?? -1;
		const fields = field.variants?.[index]?.fields;
		return fields
			? { fields, textKey: `${textKey}.variants.${index}.fields` }
			: null;
	}
	return null;
}

function check(
	fields: readonly FieldSchema[],
	values: Record<string, unknown>,
	context: Context,
	widget: { readonly label: string; readonly textKey: string },
	into: MissingOption[],
): void {
	const { path, trail, textKey, listItem } = context;
	for (const field of fields) {
		const value = values[field.key];
		const fieldKey = `${textKey}.${field.key}`;
		if (field.required && !field.hidden && isEmpty(value)) {
			const where =
				trail.length > 0 ? ` for ${[...trail].reverse().join(" in ")}` : "";
			into.push({
				path,
				message: `${widget.label} needs ${withArticle(field.label)}${where}`,
				params: {
					widget: widget.textKey,
					option: fieldKey,
					...(listItem ?? {}),
				},
			});
			continue;
		}
		if (field.kind === "list" && field.item && Array.isArray(value)) {
			const item = field.item;
			value.forEach((entry, index) => {
				const nested = objectFields(item, entry, `${fieldKey}.item`);
				const record = asRecord(entry);
				if (!nested || !record) return;
				check(
					nested.fields,
					record,
					{
						path: [...path, field.key, index],
						trail: [...trail, `${singular(field.label)} ${index + 1}`],
						textKey: nested.textKey,
						listItem: { list: fieldKey, item: index + 1 },
					},
					widget,
					into,
				);
			});
		}
		const nested = objectFields(field, value, fieldKey);
		const record = asRecord(value);
		if (field.kind === "object" && nested && record) {
			check(
				nested.fields,
				record,
				{ ...context, path: [...path, field.key], textKey: nested.textKey },
				widget,
				into,
			);
		}
	}
}

/**
 * Finds the options Glance requires that widgets don't set (from the
 * generated schemas, e.g. weather `location`), with a sentence a person can
 * act on instead of Glance's raw error.
 * Widgets that are aliases or `$include`s are skipped: their values live elsewhere.
 * @param doc - The document to check.
 * @returns Every missing option.
 */
export function findMissingOptions(doc: GlazeDocument): MissingOption[] {
	const found: MissingOption[] = [];
	const visit = (widget: WidgetNode) => {
		widget.children.forEach(visit);
		const schema = widgetSchema(widget.type);
		if (!schema || widget.isAlias || widget.include !== null) return;
		const options = getWidgetOptions(doc, widget.path);
		if (!options.ok) return;
		const values = Object.fromEntries(
			[...options.value.options].map(([key, option]) => [key, option.value]),
		);
		const textKey = `widget.${schema.type}`;
		check(
			schema.fields,
			values,
			{
				path: widget.path,
				trail: [],
				textKey: `${textKey}.fields`,
				listItem: null,
			},
			{ label: schema.label, textKey },
			found,
		);
	};
	for (const page of getModel(doc)) {
		page.headWidgets.forEach(visit);
		for (const column of page.columns) column.widgets.forEach(visit);
	}
	return found;
}
