/*
 * The schema format: how every Glance option is described for the editor.
 * The generator (scripts/generate-widget-schemas.ts) fills these from the
 * Glance source plus overrides.ts. Only erasable TypeScript here, because the
 * generator runs on plain Node.
 */

/** How a field is edited in a form. */
export type FieldKind =
	/** One line of text. */
	| "text"
	/** Text over several lines. */
	| "multiline"
	/** A web address (`http(s)://…` or a `${VAR}`). */
	| "url"
	/** A decimal number. */
	| "number"
	/** A whole number. */
	| "integer"
	| "boolean"
	/** Glance's `durationField`: a number and s, m, h or d, e.g. `30m`. */
	| "duration"
	/** One of a few words (`options`); with `allowCustom` also free text. */
	| "enum"
	/** A list; every item is described by `item`. */
	| "list"
	/** A map with fixed keys, described by `fields`. */
	| "object"
	/** A map with keys the user picks; every value is described by `item`. */
	| "map"
	/** One of several forms (`variants`), e.g. a plain string or an object. */
	| "union"
	/** An icon: `si:`, `di:`, `sh:`, `mdi:` or a URL (optionally `auto-invert `). */
	| "icon"
	/** Glance's `hslColorField`: `hue saturation lightness`. */
	| "color"
	/** An API key, token or password: hidden while typing, `${ENV}` recommended. */
	| "secret"
	/** Code in `language` (HTML, a Go template, CSS). */
	| "code"
	/** Any YAML value (custom-api `body`): edited per value with a type select. */
	| "any"
	/** Child widgets of a container; edited on the canvas, not in a form. */
	| "widgets";

/** One choice of an enum field. */
export interface EnumOption {
	readonly value: string;
	readonly label?: string;
	readonly help?: string;
}

/** The language of a `code` field, for highlighting. */
export type CodeLanguage = "html" | "go-template" | "css";

/** One option of a widget, page or config section. */
export interface FieldSchema {
	/** The YAML key. Empty for list items, map values and union variants. */
	readonly key: string;
	readonly kind: FieldKind;
	/** The Go type in the Glance source, for reference. */
	readonly goType: string;
	readonly label: string;
	readonly help?: string;
	readonly placeholder?: string;
	/** Glance refuses the config without it. */
	readonly required?: boolean;
	/** What Glance uses when the key is missing. */
	readonly default?: string | number | boolean;
	/** For `enum`. */
	readonly options?: readonly EnumOption[];
	/** For `enum`: free text is allowed too (e.g. a custom search URL). */
	readonly allowCustom?: boolean;
	/** For `list` (item) and `map` (value). */
	readonly item?: FieldSchema;
	/** For `object`. */
	readonly fields?: readonly FieldSchema[];
	/** For `union`: the forms the value can take, simplest first. */
	readonly variants?: readonly FieldSchema[];
	/** For `code`. */
	readonly language?: CodeLanguage;
	/** For `map`: what the keys are, e.g. "Container name". */
	readonly keyLabel?: string;
	readonly min?: number;
	readonly max?: number;
	/** Id of the `FieldGroup` the field is shown in. */
	readonly group?: string;
	/** Shown under "More options" instead of right away. */
	readonly advanced?: boolean;
	/** Shown above the field, e.g. for unsafe HTML. */
	readonly warning?: string;
	/** Why no form shows this field (Glance reads it, but it isn't meant to be set). */
	readonly hidden?: string;
}

/** A section of a widget form. */
export interface FieldGroup {
	readonly id: string;
	readonly label: string;
	/** The inspector tab it goes on; `settings` by default. */
	readonly tab?: "settings" | "style";
}

/** Everything about one widget type. */
export interface WidgetSchema {
	readonly type: string;
	/** Other names Glance accepts for this type (e.g. `stocks` for `markets`). */
	readonly aliases: readonly string[];
	readonly label: string;
	readonly description?: string;
	/** The Go struct in the Glance source. */
	readonly goStruct: string;
	/** The title Glance shows when `title` isn't set. */
	readonly defaultTitle?: string;
	/** How often Glance refreshes it when `cache` isn't set, e.g. `1h` or `on the hour`. */
	readonly defaultCache?: string;
	/** The widget's own options (not the `widgetBase` ones every widget has). */
	readonly fields: readonly FieldSchema[];
	readonly groups: readonly FieldGroup[];
	/** Options a widget gets when added from the library, so it starts valid. */
	readonly newWidget?: Readonly<Record<string, unknown>>;
}
