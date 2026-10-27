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
	/** E.g. "Weather needs a location". */
	readonly message: string;
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

/** The object form of a field's value: its own fields, or a union's object variant. */
function objectFields(
	field: FieldSchema,
	value: unknown,
): readonly FieldSchema[] | null {
	if (!asRecord(value)) return null;
	if (field.kind === "object") return field.fields ?? null;
	if (field.kind === "union") {
		return (
			field.variants?.find((variant) => variant.kind === "object")?.fields ??
			null
		);
	}
	return null;
}

function check(
	fields: readonly FieldSchema[],
	values: Record<string, unknown>,
	path: YamlPath,
	trail: readonly string[],
	widgetLabel: string,
	into: MissingOption[],
): void {
	for (const field of fields) {
		const value = values[field.key];
		if (field.required && !field.hidden && isEmpty(value)) {
			const where =
				trail.length > 0 ? ` for ${[...trail].reverse().join(" in ")}` : "";
			into.push({
				path,
				message: `${widgetLabel} needs ${withArticle(field.label)}${where}`,
			});
			continue;
		}
		if (field.kind === "list" && field.item && Array.isArray(value)) {
			const item = field.item;
			value.forEach((entry, index) => {
				const nested = objectFields(item, entry);
				const record = asRecord(entry);
				if (!nested || !record) return;
				check(
					nested,
					record,
					[...path, field.key, index],
					[...trail, `${singular(field.label)} ${index + 1}`],
					widgetLabel,
					into,
				);
			});
		}
		const nested = objectFields(field, value);
		const record = asRecord(value);
		if (field.kind === "object" && nested && record) {
			check(nested, record, [...path, field.key], trail, widgetLabel, into);
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
		check(schema.fields, values, widget.path, [], schema.label, found);
	};
	for (const page of getModel(doc)) {
		page.headWidgets.forEach(visit);
		for (const column of page.columns) column.widgets.forEach(visit);
	}
	return found;
}
