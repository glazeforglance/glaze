import type { FieldSchema } from "@glaze/schemas";
import { CodeField } from "../fields/CodeField.tsx";
import { useTranslation } from "react-i18next";

/** The most used parts of Glance's custom-api templates (widget-custom-api.go). */
// Template code is Go; only the explanations (`forms.template.<key>`) are translated.
const CHEAT_SHEET = [
	{ code: '.JSON.String "path"', key: "jsonString" },
	{ code: '.JSON.Array "items"', key: "jsonArray" },
	{ code: '.JSON.Exists "path"', key: "jsonExists" },
	{ code: '.Subrequest "name"', key: "subrequest" },
	{ code: '.Options.StringOr "key" "default"', key: "options" },
	{ code: 'toRelativeTime (parseTime "rfc3339" …)', key: "relativeTime" },
	{ code: "formatNumber, formatApproxNumber", key: "numbers" },
	{ code: "add, sub, mul, div, mod", key: "arithmetic" },
	{ code: "findMatch, replaceAll, trimSpace", key: "text" },
	{ code: 'class="list list-gap-10", "color-positive"', key: "classes" },
] as const;

/**
 * custom-api `template`: the code editor with Go template highlighting and a
 * short cheat sheet of Glance's template functions.
 * @param props - The option's schema and form name.
 * @returns The field.
 */
export function TemplateField({
	field,
	name,
}: {
	readonly field: FieldSchema;
	readonly name: string;
}) {
	const { t } = useTranslation();
	return (
		<>
			<CodeField
				name={name}
				label={field.label}
				language={field.language ?? "go-template"}
				hint={field.help}
			/>
			<details className="mb-4 rounded-md border border-line">
				<summary className="flex min-h-10 cursor-pointer list-none items-center px-3 text-sm text-muted hover:text-text">
					{t("forms.template.title")}
				</summary>
				<dl className="grid gap-x-3 gap-y-1.5 border-t border-line px-3 py-3 text-xs">
					{CHEAT_SHEET.map((entry) => (
						<div key={entry.code}>
							<dt dir="ltr" className="text-start font-mono text-info">
								{`{{ ${entry.code} }}`}
							</dt>
							<dd className="text-faint">{t(`forms.template.${entry.key}`)}</dd>
						</div>
					))}
				</dl>
			</details>
		</>
	);
}
