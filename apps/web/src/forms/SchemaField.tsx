import type { FieldSchema } from "@glaze/schemas";
import { type ReactNode, useId } from "react";
import { fromNumberList, toNumberList } from "./convert.ts";
import { AnyField } from "./fields/AnyField.tsx";
import { CodeField } from "./fields/CodeField.tsx";
import { ColorField } from "./fields/ColorField.tsx";
import { DurationField } from "./fields/DurationField.tsx";
import { IconField } from "./fields/IconField.tsx";
import { ListField } from "./fields/ListField.tsx";
import { MapField } from "./fields/MapField.tsx";
import { NumberField } from "./fields/NumberField.tsx";
import { PresetField } from "./fields/PresetField.tsx";
import { SegmentedField } from "./fields/SegmentedField.tsx";
import { SelectField } from "./fields/SelectField.tsx";
import { TextAreaField } from "./fields/TextAreaField.tsx";
import { TextField } from "./fields/TextField.tsx";
import { ToggleField } from "./fields/ToggleField.tsx";
import { useCustomField } from "./custom-fields.ts";
import { useWidgetField } from "./use-widget-form.ts";
import { ContainerLabelsField } from "./widgets/ContainerLabelsField.tsx";
import { TemplateField } from "./widgets/TemplateField.tsx";
import { convertVariant, itemName, newValue, variantIndex } from "./values.ts";
import { i18n } from "../i18n.ts";
import { OptionKey } from "./fields/OptionKey.tsx";

/** Enums with at most this many choices are shown as buttons, longer ones as a dropdown. */
const MAX_SEGMENTS = 4;

export interface SchemaFieldProps {
	readonly field: FieldSchema;
	/** Form field name, e.g. `sites.2.url`. */
	readonly name: string;
}

function hintOf(field: FieldSchema): string | undefined {
	const parts = [field.help];
	if (
		field.default !== undefined &&
		field.kind !== "boolean" &&
		field.kind !== "enum"
	) {
		parts.push(
			i18n.t("forms.glanceDefaultIs", { value: String(field.default) }),
		);
	}
	const text = parts.filter((part) => part !== undefined).join(" ");
	return text === "" ? undefined : text;
}

/**
 * A caution shown above a field, e.g. for HTML that isn't sanitized.
 * @param props - The text.
 * @returns The note.
 */
export function FieldWarning({ text }: { readonly text: string }) {
	return (
		<p
			role="note"
			className="mb-1.5 rounded-sm border border-accent/40 bg-accent/8 px-2.5 py-1.5 text-xs text-accent"
		>
			{text}
		</p>
	);
}

/**
 * Renders the form control for one option from its schema: the kind decides
 * the component (text, toggle, segmented buttons or dropdown, duration,
 * icon, color, code, list, map, object, union, any). Fields marked `hidden`
 * render nothing; a widget type can replace a field with its own component
 * (see custom-fields.ts).
 * @param props - The field's schema and form name.
 * @returns The control, or nothing.
 */
export function SchemaField({ field, name }: SchemaFieldProps) {
	const custom = useCustomField(name);
	if (field.hidden || field.kind === "widgets") return null;
	if (custom === "container-labels") {
		return <ContainerLabelsField field={field} name={name} />;
	}
	if (custom === "template") return <TemplateField field={field} name={name} />;
	const control = renderControl(field, name);
	return field.warning ? (
		<div>
			<FieldWarning text={field.warning} />
			{control}
		</div>
	) : (
		control
	);
}

function renderControl(field: FieldSchema, name: string): ReactNode {
	const { label, placeholder } = field;
	const hint = hintOf(field);
	switch (field.kind) {
		case "text":
			return (
				<TextField
					name={name}
					label={label}
					placeholder={placeholder}
					hint={hint}
				/>
			);
		case "multiline":
			return (
				<TextAreaField
					name={name}
					label={label}
					placeholder={placeholder}
					hint={hint}
				/>
			);
		case "secret":
			return (
				<TextField
					name={name}
					label={label}
					placeholder={placeholder}
					hint={hint}
					secret
					mono
				/>
			);
		case "url":
			return (
				<TextField
					name={name}
					label={label}
					placeholder={placeholder ?? "https://…"}
					hint={hint}
					inputMode="url"
					mono
				/>
			);
		case "number":
		case "integer":
			return (
				<NumberField
					name={name}
					label={label}
					placeholder={
						placeholder ??
						(field.default !== undefined ? String(field.default) : undefined)
					}
					hint={field.help}
				/>
			);
		case "boolean":
			return (
				<ToggleField
					name={name}
					label={label}
					hint={field.help}
					glanceDefault={field.default === true}
				/>
			);
		case "duration":
			return (
				<DurationField
					name={name}
					label={label}
					hint={field.help}
					scale={field.key === "timeout" ? "short" : "refresh"}
					defaultLabel={
						field.default !== undefined
							? i18n.t("forms.valueIsDefault", { value: String(field.default) })
							: i18n.t("forms.glanceDefault")
					}
				/>
			);
		case "enum":
			return <EnumField field={field} name={name} />;
		case "color":
			return (
				<ColorField
					name={name}
					label={label}
					placeholder={placeholder}
					hint={hint}
				/>
			);
		case "icon":
			return <IconField name={name} label={label} hint={field.help} />;
		case "code":
			return (
				<CodeField
					name={name}
					label={label}
					language={field.language}
					hint={field.help}
				/>
			);
		case "any":
			return <AnyField name={name} label={label} hint={field.help} />;
		case "object":
			return <ObjectFieldset field={field} name={name} />;
		case "union":
			return <UnionField field={field} name={name} />;
		case "list":
			return <SchemaList field={field} name={name} />;
		case "map":
			return <SchemaMap field={field} name={name} />;
		default:
			return null;
	}
}

function EnumField({ field, name }: SchemaFieldProps) {
	const options = field.options ?? [];
	const fallback = field.default;
	const defaultLabel =
		fallback !== undefined
			? i18n.t("forms.defaultIs", {
					value:
						options.find((option) => option.value === fallback)?.label ??
						String(fallback),
				})
			: i18n.t("forms.default");
	if (field.allowCustom) {
		return (
			<PresetField
				name={name}
				label={field.label}
				hint={field.help}
				presets={options.map((option) => ({
					value: option.value,
					label: option.label ?? option.value,
				}))}
				defaultLabel={defaultLabel}
				customPlaceholder={field.placeholder}
			/>
		);
	}
	// Without a default, an extra "Default" choice leaves the key out.
	const withDefault = fallback === undefined && !field.required;
	if (options.length + (withDefault ? 1 : 0) <= MAX_SEGMENTS) {
		return (
			<SegmentedField
				name={name}
				label={field.label}
				hint={field.help}
				glanceDefault={typeof fallback === "string" ? fallback : ""}
				segments={[
					...(withDefault
						? [{ value: "", label: i18n.t("forms.default") }]
						: []),
					...options.map((option) => ({
						value: option.value,
						label: option.label ?? option.value,
					})),
				]}
			/>
		);
	}
	return (
		<SelectField
			name={name}
			label={field.label}
			hint={field.help}
			defaultLabel={defaultLabel}
			options={options.map((option) => ({
				value: option.value,
				label: option.label ?? option.value,
			}))}
		/>
	);
}

/**
 * The fields of an object, normal ones first and `advanced` ones behind
 * "More options".
 * @param props - The fields and the name of the object they belong to.
 * @returns The fields.
 */
export function FieldList({
	fields,
	prefix,
}: {
	readonly fields: readonly FieldSchema[];
	/** Name of the object, e.g. `sites.2`; empty for a widget's own options. */
	readonly prefix: string;
}) {
	const shown = fields.filter(
		(field) => !field.hidden && field.kind !== "widgets",
	);
	const nameOf = (field: FieldSchema) =>
		prefix ? `${prefix}.${field.key}` : field.key;
	const main = shown.filter((field) => !field.advanced);
	const more = shown.filter((field) => field.advanced);
	return (
		<>
			{main.map((field) => (
				<SchemaField key={field.key} field={field} name={nameOf(field)} />
			))}
			{more.length > 0 && (
				<details className="group mb-4 rounded-md border border-line">
					<summary className="flex min-h-10 cursor-pointer list-none items-center px-3 text-sm text-muted hover:text-text">
						{i18n.t("forms.moreOptions")}
						<span className="ms-auto font-mono text-[11px] text-faint">
							{more.length}
						</span>
					</summary>
					<div className="border-t border-line px-3 pt-3">
						{more.map((field) => (
							<SchemaField key={field.key} field={field} name={nameOf(field)} />
						))}
					</div>
				</details>
			)}
		</>
	);
}

function ObjectFieldset({ field, name }: SchemaFieldProps) {
	const id = useId();
	return (
		<fieldset
			aria-labelledby={id}
			className="mb-4 min-w-0 rounded-md border border-line px-3 pt-2"
		>
			<legend
				id={id}
				className="px-1 font-mono text-[11px] font-semibold tracking-wider text-muted uppercase"
			>
				{field.label} <OptionKey name={name} />
			</legend>
			{field.help && <p className="mb-3 text-xs text-faint">{field.help}</p>}
			<FieldList fields={field.fields ?? []} prefix={name} />
		</fieldset>
	);
}

function SchemaList({ field, name }: SchemaFieldProps) {
	const item = field.item;
	if (!item) return null;
	// A list of numbers (e.g. status codes) reads best as "401, 403".
	if (item.kind === "integer" || item.kind === "number") {
		return (
			<TextField
				name={name}
				label={field.label}
				hint={field.help ?? i18n.t("forms.commaSeparated")}
				parse={toNumberList}
				format={fromNumberList}
				mono
			/>
		);
	}
	const isObject = item.kind === "object";
	// Always set for list items (see `listItemLabel` in @glaze/schemas), and translated.
	const word = item.label || field.label;
	return (
		<ListField
			name={name}
			label={field.label}
			hint={field.help}
			addLabel={i18n.t("forms.list.add", { item: word })}
			collapsible={isObject}
			newItem={() => newValue(item)}
			itemTitle={(value, index) =>
				itemName(
					value,
					i18n.t("forms.list.itemNumber", { item: word, number: index + 1 }),
				)
			}
			itemSubtitle={(value) =>
				isObject && typeof value === "object" && value !== null
					? (Object.values(value).find(
							(entry): entry is string =>
								typeof entry === "string" && entry !== itemName(value, ""),
						) ?? null)
					: null
			}
		>
			{(path) =>
				isObject ? (
					<FieldList fields={item.fields ?? []} prefix={path} />
				) : (
					<SchemaField
						field={{ ...item, label: item.label || word }}
						name={path}
					/>
				)
			}
		</ListField>
	);
}

function SchemaMap({ field, name }: SchemaFieldProps) {
	const item = field.item;
	if (!item) return null;
	const keyLabel = field.keyLabel ?? i18n.t("forms.map.name");
	return (
		<MapField
			name={name}
			label={field.label}
			keyLabel={keyLabel}
			addLabel={i18n.t("forms.map.add")}
			hint={field.help}
			// A new entry needs a value; YAML writes an empty map as {}.
			newEntry={() => newValue(item) ?? ""}
		>
			{(entryName, key) =>
				item.kind === "object" ? (
					<FieldList fields={item.fields ?? []} prefix={entryName} />
				) : (
					<SchemaField
						field={{
							...item,
							label: item.label || key,
							keyLabel: item.keyLabel ?? i18n.t("forms.map.name"),
						}}
						name={entryName}
					/>
				)
			}
		</MapField>
	);
}

function UnionField({ field, name }: SchemaFieldProps) {
	const id = useId();
	const widgetField = useWidgetField(name);
	const variants = field.variants ?? [];
	const value: unknown = widgetField.field.value;
	const active = variantIndex(field, value);
	const variant = variants[active];
	return (
		<div className="mb-4">
			<div className="mb-1.5 flex min-h-5 flex-wrap items-center gap-2">
				<span
					id={`${id}-label`}
					className="font-mono text-[11px] font-semibold tracking-wider text-muted uppercase"
				>
					{field.label}
				</span>
				<OptionKey name={name} />
				<span
					role="radiogroup"
					aria-labelledby={`${id}-label`}
					className="ms-auto flex gap-1"
				>
					{variants.map((option, index) => (
						<button
							key={option.label}
							type="button"
							role="radio"
							aria-checked={index === active}
							disabled={widgetField.disabled}
							onClick={() => {
								if (index === active) return;
								const next = convertVariant(field, value, index);
								widgetField.field.onChange(next);
								widgetField.commit(next);
							}}
							className={`min-h-7 cursor-pointer rounded-[6px] px-2 text-[11px] ${
								index === active
									? "bg-accent/10 font-semibold text-accent"
									: "text-muted hover:bg-card-hover hover:text-text"
							}`}
						>
							{option.label}
						</button>
					))}
				</span>
			</div>
			{field.help && <p className="mb-2 text-xs text-faint">{field.help}</p>}
			{variant &&
				(variant.kind === "object" ? (
					<div className="rounded-md border border-line px-3 pt-3">
						<FieldList fields={variant.fields ?? []} prefix={name} />
					</div>
				) : (
					<SchemaField field={variant} name={name} />
				))}
		</div>
	);
}
