import type { FieldSchema } from "@glaze/schemas";
import { CodeField } from "../fields/CodeField.tsx";

/** The most used parts of Glance's custom-api templates (widget-custom-api.go). */
const CHEAT_SHEET: readonly { code: string; text: string }[] = [
	{
		code: '.JSON.String "path"',
		text: "a value from the response (also .Int, .Float, .Bool)",
	},
	{ code: '.JSON.Array "items"', text: "a list to loop over with range" },
	{ code: '.JSON.Exists "path"', text: "whether a value is there" },
	{ code: '.Subrequest "name"', text: "the response of a subrequest" },
	{ code: '.Options.StringOr "key" "default"', text: "a value from options" },
	{
		code: 'toRelativeTime (parseTime "rfc3339" …)',
		text: "“2h ago”, kept up to date",
	},
	{ code: "formatNumber, formatApproxNumber", text: "1,234 and 1.2k" },
	{ code: "add, sub, mul, div, mod", text: "arithmetic" },
	{ code: "findMatch, replaceAll, trimSpace", text: "text helpers" },
	{
		code: 'class="list list-gap-10", "color-positive"',
		text: "Glance's own CSS classes",
	},
];

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
					Template cheat sheet
				</summary>
				<dl className="grid gap-x-3 gap-y-1.5 border-t border-line px-3 py-3 text-xs">
					{CHEAT_SHEET.map((entry) => (
						<div key={entry.code}>
							<dt className="font-mono text-info">{`{{ ${entry.code} }}`}</dt>
							<dd className="text-faint">{entry.text}</dd>
						</div>
					))}
				</dl>
			</details>
		</>
	);
}
