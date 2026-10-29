import {
	BASE_FIELDS,
	type FieldSchema,
	type WidgetSchema,
} from "@glaze/schemas";
import { FieldList } from "./SchemaField.tsx";
import { useWidgetForm } from "./use-widget-form.ts";
import { Trans, useTranslation } from "react-i18next";

export interface SchemaFormProps {
	readonly schema: WidgetSchema;
	readonly tab: "settings" | "style";
}

/** The tab a field goes on: its group's tab, or Settings. */
function tabOf(schema: WidgetSchema, field: FieldSchema): "settings" | "style" {
	const group = schema.groups.find((candidate) => candidate.id === field.group);
	return group?.tab ?? "settings";
}

/**
 * A widget's own options, generated from its schema: on the Settings tab the
 * ungrouped fields and then each Settings group with a heading; on the Style
 * tab the fields of Style groups (e.g. "Display").
 * @param props - The widget type's schema and the tab.
 * @returns The fields.
 */
export function SchemaForm({ schema, tab }: SchemaFormProps) {
	const fields = schema.fields.filter((field) => tabOf(schema, field) === tab);
	const loose = fields.filter((field) => field.group === undefined);
	const groups = schema.groups
		.filter((group) => (group.tab ?? "settings") === tab)
		.map((group) => ({
			group,
			fields: fields.filter((field) => field.group === group.id),
		}))
		.filter(({ fields: inGroup }) => inGroup.length > 0);
	return (
		<>
			<FieldList fields={loose} prefix="" />
			{groups.map(({ group, fields: inGroup }) =>
				// On the Style tab the group is the whole tab; no extra heading.
				tab === "style" ? (
					<FieldList key={group.id} fields={inGroup} prefix="" />
				) : (
					<section key={group.id} aria-label={group.label} className="mt-2">
						<h3 className="mb-3 border-b border-line pb-1.5 text-sm font-semibold">
							{group.label}
						</h3>
						<FieldList fields={inGroup} prefix="" />
					</section>
				),
			)}
		</>
	);
}

/**
 * Options the widget sets that Glance doesn't know for its type (from a
 * newer Glance version, or a typo). They stay in the YAML untouched; this
 * lists them, with a way to the YAML tab to fix or remove them.
 * @param props - The schema (or `null` for an unknown type) and the YAML link.
 * @returns The section, or nothing when every option is known.
 */
export function OtherOptions({
	schema,
	onShowYaml,
}: {
	readonly schema: WidgetSchema | null;
	readonly onShowYaml: () => void;
}) {
	const { t } = useTranslation();
	const { options } = useWidgetForm();
	const known = new Set([
		...BASE_FIELDS.map((field) => field.key),
		...(schema?.fields.map((field) => field.key) ?? []),
	]);
	const other = [...options.values()].filter(
		(option) => !known.has(option.key),
	);
	if (other.length === 0) return null;
	return (
		<section
			aria-label={t("forms.other.title")}
			className="mt-2 mb-4 rounded-md border border-line p-3"
		>
			<h3 className="text-sm font-semibold">{t("forms.other.title")}</h3>
			<p className="mt-1 mb-2 text-xs text-faint">
				<Trans
					i18nKey={
						schema ? "forms.other.unknownFor" : "forms.other.unknownType"
					}
					values={schema ? { widget: schema.label } : {}}
					components={{
						yaml: (
							<button
								type="button"
								onClick={onShowYaml}
								className="cursor-pointer text-accent underline-offset-2 hover:underline"
							/>
						),
					}}
				/>
			</p>
			<ul className="flex flex-col gap-1">
				{other.map((option) => (
					<li
						key={option.key}
						dir="ltr"
						className="flex gap-2 font-mono text-xs"
					>
						<span className="text-muted">{option.key}:</span>
						<span className="truncate text-faint">
							{JSON.stringify(option.value)}
						</span>
					</li>
				))}
			</ul>
		</section>
	);
}
