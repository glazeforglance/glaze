/*
 * The shape of overrides.ts: what a person adds to the generated schemas.
 * Only erasable TypeScript here, because the generator runs on plain Node.
 */
import type {
	EnumOption,
	FieldGroup,
	FieldKind,
	FieldSchema,
} from "./types.ts";

/** Hand-written additions for one field. */
export interface FieldOverride {
	readonly kind?: FieldKind;
	readonly label?: string;
	readonly help?: string;
	readonly placeholder?: string;
	readonly required?: boolean;
	readonly default?: string | number | boolean;
	readonly options?: readonly EnumOption[];
	readonly allowCustom?: boolean;
	readonly language?: FieldSchema["language"];
	readonly keyLabel?: string;
	readonly min?: number;
	readonly max?: number;
	readonly group?: string;
	readonly advanced?: boolean;
	readonly warning?: string;
	readonly hidden?: string;
	/** Fields of an object, or of the objects in a list or map. */
	readonly fields?: Readonly<Record<string, FieldOverride>>;
	/** The item of a list or the value of a map. */
	readonly item?: FieldOverride;
	/** The variants of a union, by position. */
	readonly variants?: readonly FieldOverride[];
}

/** Hand-written additions for one widget type. */
export interface WidgetOverride {
	readonly label: string;
	readonly description?: string;
	readonly groups?: readonly FieldGroup[];
	/** Field keys in display order; unlisted fields follow in source order. */
	readonly order?: readonly string[];
	readonly fields?: Readonly<Record<string, FieldOverride>>;
	/** Options a new widget from the library starts with, so it is valid right away. */
	readonly newWidget?: Readonly<Record<string, unknown>>;
}

/** Everything overrides.ts exports, in one object. */
export interface Overrides {
	readonly base: Readonly<Record<string, FieldOverride>>;
	readonly widgets: Readonly<Record<string, WidgetOverride>>;
	readonly page: Readonly<Record<string, FieldOverride>>;
	readonly config: Readonly<Record<string, FieldOverride>>;
}
