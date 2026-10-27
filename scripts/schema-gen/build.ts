// Turns the parsed Glance source into schemas: struct fields become
// FieldSchemas (following yaml.v3's rules), facts from initialize() add
// defaults, enums and required flags, and the hand-written overrides add
// labels, help texts and everything else the code can't tell.
//
// Runs on plain Node (built-in type stripping), so only erasable TypeScript here.

import type {
	FieldOverride,
	Overrides,
} from "../../packages/schemas/src/override-types.ts";
import type {
	FieldKind,
	FieldSchema,
	WidgetSchema,
} from "../../packages/schemas/src/types.ts";
import {
	analyzeBody,
	analyzeWidget,
	type CodeFacts,
	type FieldFacts,
} from "./analyze.ts";
import type { GoField, GoPackage, GoType } from "./go-parse.ts";
import { yamlKey } from "./go-parse.ts";

export type {
	FieldOverride,
	Overrides,
	WidgetOverride,
} from "../../packages/schemas/src/override-types.ts";

/** The generator's result. */
export interface SchemaSet {
	readonly generatedFrom: string;
	readonly base: readonly FieldSchema[];
	readonly widgets: readonly WidgetSchema[];
	readonly page: readonly FieldSchema[];
	readonly config: readonly FieldSchema[];
}

/** The parsed packages: Glance's own and the ones it imports types from. */
export interface Packages {
	readonly glance: GoPackage;
	readonly others: ReadonlyMap<string, GoPackage>;
}

// Words that read better in capitals in a generated label.
const UPPER = new Set(["url", "id", "html", "api", "css", "ui", "dns"]);

/**
 * Makes a label from a YAML key: `title-url` → "Title URL".
 * @param key - The key.
 * @returns The label.
 */
export function labelFromKey(key: string): string {
	const words = key.split("-").map((word, index) => {
		if (UPPER.has(word)) return word.toUpperCase();
		return index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
	});
	return words.join(" ");
}

function goTypeText(type: GoType): string {
	switch (type.kind) {
		case "name": {
			const name = type.pkg ? `${type.pkg}.${type.name}` : type.name;
			return type.args.length > 0
				? `${name}[${type.args.map(goTypeText).join(", ")}]`
				: name;
		}
		case "pointer":
			return `*${goTypeText(type.elem)}`;
		case "slice":
			return `[]${goTypeText(type.elem)}`;
		case "array":
			return `[n]${goTypeText(type.elem)}`;
		case "map":
			return `map[${goTypeText(type.key)}]${goTypeText(type.value)}`;
		case "struct":
			return "struct";
		case "interface":
			return "any";
		default:
			return type.text;
	}
}

/** A struct type and the facts its methods (and its owner's) state about it. */
interface StructContext {
	readonly pkg: GoPackage;
	readonly fields: readonly GoField[];
	readonly facts: FieldFacts;
	/** Where we are, for error messages: `releases.repositories`. */
	readonly where: string;
}

class Builder {
	readonly packages: Packages;
	constructor(packages: Packages) {
		this.packages = packages;
	}

	pkgOf(name: string | null): GoPackage {
		if (name === null) return this.packages.glance;
		const pkg = this.packages.others.get(name);
		if (!pkg) throw new Error(`No source for Go package "${name}"`);
		return pkg;
	}

	/** Facts from every method of a named struct type (initialize() and friends). */
	factsOf(pkg: GoPackage, typeName: string): FieldFacts {
		const facts: FieldFacts = new Map();
		for (const fn of pkg.funcs) {
			if (fn.receiverType !== typeName) continue;
			for (const [path, fact] of analyzeBody(fn, pkg)) {
				facts.set(path, {
					...facts.get(path),
					...mergeFacts(facts.get(path), fact),
				});
			}
		}
		return facts;
	}

	/** The object form of a custom type that also accepts a plain string. */
	structVariant(
		name: string,
		label: string,
		context: StructContext,
	): FieldSchema {
		const decl = this.packages.glance.types.get(name);
		if (decl?.kind !== "struct") throw new Error(`${name} isn't a struct`);
		return {
			key: "",
			goType: name,
			label,
			kind: "object",
			fields: this.structFields({
				...context,
				fields: decl.fields,
				facts: this.factsOf(this.packages.glance, name),
			}),
		};
	}

	/** Builds the fields of a struct, inlining `,inline` fields. */
	structFields(context: StructContext): FieldSchema[] {
		const result: FieldSchema[] = [];
		for (const field of context.fields) {
			const yaml = yamlKey(field);
			if (!yaml) continue;
			if (yaml.inline) {
				result.push(...this.inlineFields(field.type, context));
				continue;
			}
			const sub = new Map<string, CodeFacts>();
			for (const [path, fact] of context.facts) {
				if (path.startsWith(`${field.name}.`)) {
					sub.set(path.slice(field.name.length + 1), fact);
				}
			}
			const schema = this.fieldSchema(yaml.key, field.type, {
				...context,
				facts: sub,
				where: `${context.where}.${yaml.key}`,
			});
			result.push(applyFacts(schema, context.facts.get(field.name)));
		}
		return result;
	}

	inlineFields(type: GoType, context: StructContext): FieldSchema[] {
		const target = type.kind === "pointer" ? type.elem : type;
		if (target.kind === "struct") {
			return this.structFields({ ...context, fields: target.fields });
		}
		if (target.kind !== "name") {
			throw new Error(`Can't inline ${goTypeText(type)} at ${context.where}`);
		}
		const pkg = target.pkg ? this.pkgOf(target.pkg) : context.pkg;
		const decl = pkg.types.get(target.name);
		if (decl?.kind !== "struct") {
			throw new Error(
				`Inline type ${goTypeText(type)} at ${context.where} isn't a struct`,
			);
		}
		const own = this.factsOf(pkg, target.name);
		return this.structFields({
			pkg,
			fields: decl.fields,
			facts: new Map([...own, ...context.facts]),
			where: context.where,
		});
	}

	fieldSchema(key: string, type: GoType, context: StructContext): FieldSchema {
		const goType = goTypeText(type);
		const base = { key, goType, label: key ? labelFromKey(key) : "" };
		const target = type.kind === "pointer" ? type.elem : type;

		if (target.kind === "interface") return { ...base, kind: "any" };
		if (target.kind === "struct") {
			return {
				...base,
				kind: "object",
				fields: this.structFields({ ...context, fields: target.fields }),
			};
		}
		if (target.kind === "slice" || target.kind === "array") {
			return {
				...base,
				kind: "list",
				item: this.fieldSchema("", target.elem, context),
			};
		}
		if (target.kind === "map") {
			if (target.key.kind !== "name" || target.key.name !== "string") {
				throw new Error(`Map keys must be strings at ${context.where}`);
			}
			return {
				...base,
				kind: "map",
				item: this.fieldSchema("", target.value, context),
			};
		}
		if (target.kind !== "name") {
			throw new Error(`Unsupported type ${goType} at ${context.where}`);
		}

		const qualified = target.pkg ? `${target.pkg}.${target.name}` : target.name;
		const custom = CUSTOM_TYPES[qualified];
		if (custom) return custom(this, base, target, context);
		const scalar = SCALARS[qualified];
		if (scalar) return { ...base, kind: kindForKey(key, scalar) };

		const pkg = target.pkg ? this.pkgOf(target.pkg) : context.pkg;
		const decl = pkg.types.get(target.name);
		if (!decl) throw new Error(`Unknown type ${qualified} at ${context.where}`);
		if (pkg.methods.get(target.name)?.has("UnmarshalYAML")) {
			throw new Error(
				`${qualified} (at ${context.where}) has its own UnmarshalYAML; add it to CUSTOM_TYPES in scripts/schema-gen/build.ts`,
			);
		}
		if (decl.kind === "struct") {
			const own = this.factsOf(pkg, target.name);
			return {
				...base,
				kind: "object",
				fields: this.structFields({
					pkg,
					fields: decl.fields,
					facts: new Map([...own, ...context.facts]),
					where: context.where,
				}),
			};
		}
		// A named non-struct type (e.g. `type customAPIOptions map[string]any`).
		return { ...this.fieldSchema(key, decl, { ...context, pkg }), goType };
	}
}

function mergeFacts(a: CodeFacts | undefined, b: CodeFacts): CodeFacts {
	if (!a) return b;
	return {
		...a,
		...b,
		options: b.options ?? a.options,
		compared: [...new Set([...(a.compared ?? []), ...(b.compared ?? [])])],
	};
}

const SCALARS: Readonly<Record<string, FieldKind>> = {
	string: "text",
	bool: "boolean",
	int: "integer",
	int8: "integer",
	int16: "integer",
	int32: "integer",
	int64: "integer",
	uint: "integer",
	uint8: "integer",
	uint16: "integer",
	uint32: "integer",
	uint64: "integer",
	float32: "number",
	float64: "number",
	"template.HTML": "code",
};

/** Better first guesses for plain strings, from the key. */
function kindForKey(key: string, kind: FieldKind): FieldKind {
	if (kind !== "text") return kind;
	if (key === "url" || key.endsWith("-url")) return "url";
	if (
		["token", "password", "secret", "secret-key", "password-hash"].includes(
			key,
		) ||
		key.endsWith("-token")
	) {
		return "secret";
	}
	return kind;
}

type CustomBuilder = (
	builder: Builder,
	base: { key: string; goType: string; label: string },
	type: Extract<GoType, { kind: "name" }>,
	context: StructContext,
) => FieldSchema;

/**
 * Types with their own UnmarshalYAML (or special meaning). The generator
 * fails on any other type with an UnmarshalYAML, so a new one in a future
 * Glance version can't slip through as a plain struct.
 */
const CUSTOM_TYPES: Readonly<Record<string, CustomBuilder>> = {
	// `30s`, `5m`, `1h`, `1d` (config-fields.go).
	durationField: (_, base) => ({ ...base, kind: "duration" }),
	// `240 13 95` or `hsl(240, 13%, 95%)`.
	hslColorField: (_, base) => ({ ...base, kind: "color" }),
	// A string: `si:`/`di:`/`mdi:`/`sh:` + name, or a URL, optionally `auto-invert `.
	customIconField: (_, base) => ({ ...base, kind: "icon" }),
	// A proxy URL, or an object with url / allow-insecure / timeout.
	proxyOptionsField: (builder, base, _type, context) => ({
		...base,
		kind: "union",
		variants: [
			{ key: "", goType: "string", label: "Proxy URL", kind: "url" },
			builder.structVariant("proxyOptionsField", "Proxy settings", context),
		],
	}),
	// A map whose values are a string or a list of strings (numbers and booleans become strings).
	queryParametersField: (_, base) => ({
		...base,
		kind: "map",
		item: {
			key: "",
			goType: "string | []string",
			label: "Value",
			kind: "union",
			variants: [
				{ key: "", goType: "string", label: "One value", kind: "text" },
				{
					key: "",
					goType: "[]string",
					label: "Several values",
					kind: "list",
					item: { key: "", goType: "string", label: "Value", kind: "text" },
				},
			],
		},
	}),
	// `owner/repo` (with an optional `gitlab:` / `dockerhub:` / `codeberg:` prefix) or an object.
	releaseRequest: (builder, base, _type, context) => ({
		...base,
		kind: "union",
		variants: [
			{ key: "", goType: "string", label: "Repository", kind: "text" },
			builder.structVariant(
				"releaseRequest",
				"Repository with options",
				context,
			),
		],
	}),
	// A map that keeps its key order (theme presets).
	orderedYAMLMap: (builder, base, type, context) => {
		const value = type.args[1];
		if (!value)
			throw new Error(
				`orderedYAMLMap without a value type at ${context.where}`,
			);
		return {
			...base,
			kind: "map",
			item: builder.fieldSchema("", value, context),
		};
	},
	// Child widgets of a group / split-column, or a page's head widgets.
	widgets: (_, base) => ({ ...base, kind: "widgets" }),
	"template.HTML": (_, base) => ({ ...base, kind: "code", language: "html" }),
};

/** Values the Glance code checks a field against; overrides must keep them. */
const CODE_VALUES = new WeakMap<FieldSchema, readonly string[]>();

function applyFacts(
	schema: FieldSchema,
	facts: CodeFacts | undefined,
): FieldSchema {
	if (!facts) return schema;
	let next: FieldSchema = schema;
	if (facts.default !== undefined) next = { ...next, default: facts.default };
	if (facts.required) next = { ...next, required: true };
	if (facts.options && facts.options.length > 0) {
		next = {
			...next,
			kind: "enum",
			options: facts.options.map((value) => ({ value })),
			...(facts.allowCustom ? { allowCustom: true } : {}),
		};
	}
	const values = [
		...new Set([...(facts.options ?? []), ...(facts.compared ?? [])]),
	];
	if (values.length > 0) CODE_VALUES.set(next, values);
	return next;
}

/**
 * Fields whose values the Glance code compares with words, but that ended up
 * as plain text: the overrides should say whether they are an enum.
 * @param fields - Built fields.
 * @param where - Path for the report.
 * @returns `path: values` lines.
 */
export function unclassified(
	fields: readonly FieldSchema[],
	where: string,
): string[] {
	return fields.flatMap((field) => {
		const values = CODE_VALUES.get(field);
		const nested = [
			...(field.fields
				? unclassified(field.fields, `${where}.${field.key}`)
				: []),
			...(field.item?.fields
				? unclassified(field.item.fields, `${where}.${field.key}[]`)
				: []),
		];
		return values && field.kind !== "enum" && !field.hidden
			? [`${where}.${field.key}: ${values.join(", ")}`, ...nested]
			: nested;
	});
}

/**
 * Applies overrides to fields. Every override must point at a field that
 * exists, so a renamed or removed Glance option fails the generator instead
 * of silently keeping a stale override.
 */
function applyOverrides(
	fields: readonly FieldSchema[],
	overrides: Readonly<Record<string, FieldOverride>> | undefined,
	where: string,
): FieldSchema[] {
	const keys = new Set(fields.map((field) => field.key));
	for (const key of Object.keys(overrides ?? {})) {
		if (!keys.has(key)) {
			throw new Error(
				`Override for ${where}.${key}: no such field (fields: ${[...keys].join(", ") || "none"})`,
			);
		}
	}
	return fields.map((field) =>
		overrideField(field, overrides?.[field.key], `${where}.${field.key}`),
	);
}

function overrideField(
	field: FieldSchema,
	override: FieldOverride | undefined,
	where: string,
): FieldSchema {
	if (!override) return field;
	const { fields, item, variants, ...own } = override;
	let next: FieldSchema = { ...field, ...own };
	const found = CODE_VALUES.get(field);
	if (found) CODE_VALUES.set(next, found);
	if (own.options && found) {
		// The override may relabel and extend, but not drop, values Glance's code accepts.
		const missing = found.filter(
			(value) => !own.options?.some((option) => option.value === value),
		);
		if (missing.length > 0) {
			throw new Error(
				`Override for ${where} lists options without ${missing.map((m) => `"${m}"`).join(", ")}, which the Glance source accepts`,
			);
		}
	}
	if (fields) {
		if (next.kind === "object" && next.fields) {
			next = { ...next, fields: applyOverrides(next.fields, fields, where) };
		} else if (next.item?.kind === "object" && next.item.fields) {
			next = {
				...next,
				item: {
					...next.item,
					fields: applyOverrides(next.item.fields, fields, where),
				},
			};
		} else {
			throw new Error(
				`Override for ${where} has "fields", but it holds no object`,
			);
		}
	}
	if (item) {
		if (!next.item)
			throw new Error(
				`Override for ${where} has "item", but it is no list or map`,
			);
		next = { ...next, item: overrideField(next.item, item, `${where}[]`) };
	}
	if (variants) {
		const current = next.variants ?? [];
		if (variants.length > current.length) {
			throw new Error(
				`Override for ${where} has ${variants.length} variants, the field ${current.length}`,
			);
		}
		next = {
			...next,
			variants: current.map((variant, index) =>
				overrideField(variant, variants[index], `${where}|${index}`),
			),
		};
	}
	return next;
}

function order(
	fields: readonly FieldSchema[],
	keys: readonly string[] | undefined,
	where: string,
): FieldSchema[] {
	if (!keys) return [...fields];
	for (const key of keys) {
		if (!fields.some((field) => field.key === key)) {
			throw new Error(`Order for ${where} names "${key}", which isn't a field`);
		}
	}
	const rank = (key: string) => {
		const index = keys.indexOf(key);
		return index === -1 ? keys.length : index;
	};
	return fields
		.map((field, index) => ({ field, index }))
		.sort((a, b) => rank(a.field.key) - rank(b.field.key) || a.index - b.index)
		.map(({ field }) => field);
}

/**
 * Builds every schema from the parsed source and the overrides.
 * @param packages - Glance's parsed packages.
 * @param overrides - The hand-written overrides.
 * @param tag - The Glance version the source belongs to.
 * @returns The schemas.
 */
export function buildSchemas(
	packages: Packages,
	overrides: Overrides,
	tag: string,
): SchemaSet {
	const builder = new Builder(packages);
	const glance = packages.glance;
	const structOf = (name: string) => {
		const type = glance.types.get(name);
		if (type?.kind !== "struct")
			throw new Error(`No struct ${name} in the source`);
		return type.fields;
	};

	const baseFields = builder.structFields({
		pkg: glance,
		fields: structOf("widgetBase"),
		facts: new Map(),
		where: "widgetBase",
	});
	const baseKeys = new Set(baseFields.map((field) => field.key));

	const known = new Set(glance.factory.flatMap((entry) => entry.names));
	for (const type of Object.keys(overrides.widgets)) {
		if (!known.has(type))
			throw new Error(`Override for widget "${type}": Glance has no such type`);
	}

	const widgets = glance.factory.map(({ names, struct }) => {
		const [type = "", ...aliases] = names;
		const override = overrides.widgets[type];
		if (!override)
			throw new Error(
				`No override for widget type "${type}"; add at least a label`,
			);
		const facts = builder.factsOf(glance, struct);
		const all = builder.structFields({
			pkg: glance,
			fields: structOf(struct),
			facts,
			where: type,
		});
		const own = all.filter((field) => !baseKeys.has(field.key));
		const init = glance.funcs.find(
			(fn) => fn.receiverType === struct && fn.name === "initialize",
		);
		const widgetFacts = init ? analyzeWidget(init) : {};
		const fields = order(
			applyOverrides(own, override.fields, type),
			override.order,
			type,
		);
		for (const field of fields) {
			if (
				field.group &&
				!override.groups?.some((group) => group.id === field.group)
			) {
				throw new Error(
					`${type}.${field.key} is in group "${field.group}", which ${type} doesn't define`,
				);
			}
		}
		const schema: WidgetSchema = {
			type,
			aliases,
			label: override.label,
			...(override.description ? { description: override.description } : {}),
			goStruct: struct,
			...(widgetFacts.defaultTitle !== undefined
				? { defaultTitle: widgetFacts.defaultTitle }
				: {}),
			...(widgetFacts.defaultCache
				? { defaultCache: widgetFacts.defaultCache }
				: {}),
			fields,
			groups: override.groups ?? [],
			...(override.newWidget ? { newWidget: override.newWidget } : {}),
		};
		return schema;
	});

	const pageFields = builder.structFields({
		pkg: glance,
		fields: structOf("page"),
		facts: new Map(),
		where: "page",
	});
	const configFields = builder.structFields({
		pkg: glance,
		fields: structOf("config"),
		facts: new Map(),
		where: "config",
	});

	return {
		generatedFrom: tag,
		base: applyOverrides(baseFields, overrides.base, "widgetBase"),
		widgets,
		page: applyOverrides(pageFields, overrides.page, "page"),
		config: applyOverrides(configFields, overrides.config, "config"),
	};
}
