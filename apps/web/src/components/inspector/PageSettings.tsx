import { type PageNode, slugFromName, slugProblem } from "@glaze/core";
import { PAGE_FIELDS } from "@glaze/schemas";
import { TextField } from "../../forms/fields/TextField.tsx";
import { MapForm } from "../../forms/MapForm.tsx";
import { FieldList, FieldWarning } from "../../forms/SchemaField.tsx";
import { useEditor } from "../../store/editor-store.ts";

/** Page options shown in their own way at the top of the form. */
const OWN_FIELDS = new Set(["name", "slug"]);

const WIDTH_HINT =
	"Slim pages have at most 2 columns; default and wide pages at most 3.";

/**
 * The open page's settings in the inspector: name, URL path (suggested from
 * the name, checked for clashes), width and the navigation and layout
 * switches. Every field is one edit of the page's map in the YAML.
 * @param props - The open page.
 * @returns The settings.
 */
export function PageSettings({ page }: { readonly page: PageNode }) {
	const pages = useEditor((state) => state.pages);
	const setValueAt = useEditor((state) => state.setValueAt);
	const close = useEditor((state) => state.closePageSettings);
	const index = pages.findIndex((candidate) => candidate.id === page.id);
	const suggestion = slugFromName(page.name ?? "");
	const problem = slugProblem(pages, index);
	const rest = PAGE_FIELDS.filter((field) => !OWN_FIELDS.has(field.key)).map(
		(field) =>
			field.key === "width"
				? { ...field, help: [field.help, WIDTH_HINT].filter(Boolean).join(" ") }
				: field,
	);

	return (
		<>
			<header className="mb-4 flex items-start gap-3">
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-lg font-bold">Page settings</h2>
					<p className="truncate font-mono text-xs text-muted">
						{page.name ?? "Untitled page"} · /{page.slug ?? suggestion}
					</p>
				</div>
				<button
					type="button"
					onClick={close}
					className="cursor-pointer rounded-sm px-2 py-1 text-xs text-muted hover:text-text"
				>
					Close
				</button>
			</header>
			{page.include !== null ? (
				<p className="text-sm text-muted">
					This page comes from <code className="font-mono">{page.include}</code>
					; edit that file instead.
				</p>
			) : (
				// Keyed by page: another page gets a fresh form.
				<MapForm key={page.id} basePath={page.path} fields={PAGE_FIELDS}>
					<TextField name="name" label="Name" />
					<TextField
						name="slug"
						label="URL path"
						placeholder={suggestion}
						hint={`Glance uses /${suggestion} when this is empty.`}
						mono
					/>
					{problem && <FieldWarning text={problem} />}
					{page.slug === null && suggestion !== "" && problem === null && (
						<button
							type="button"
							onClick={() => setValueAt(page.path, ["slug"], suggestion)}
							className="-mt-2 mb-4 cursor-pointer text-xs text-accent underline-offset-2 hover:underline"
						>
							Write “{suggestion}” into the config
						</button>
					)}
					<FieldList fields={rest} prefix="" />
				</MapForm>
			)}
		</>
	);
}
