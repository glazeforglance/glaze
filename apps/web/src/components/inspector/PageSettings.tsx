import { type PageNode, slugFromName, slugProblem } from "@glaze/core";
import { PAGE_FIELDS } from "@glaze/schemas";
import { TextField } from "../../forms/fields/TextField.tsx";
import { MapForm } from "../../forms/MapForm.tsx";
import { FieldList, FieldWarning } from "../../forms/SchemaField.tsx";
import { useEditor } from "../../store/editor-store.ts";
import { Trans, useTranslation } from "react-i18next";
import { localizedFields } from "../../i18n.ts";
import { problemText } from "../../lib/messages.ts";

/** Page options shown in their own way at the top of the form. */
const OWN_FIELDS = new Set(["name", "slug"]);

/**
 * The open page's settings in the inspector: name, URL path (suggested from
 * the name, checked for clashes), width and the navigation and layout
 * switches. Every field is one edit of the page's map in the YAML.
 * @param props - The open page.
 * @returns The settings.
 */
export function PageSettings({ page }: { readonly page: PageNode }) {
	const { t } = useTranslation();
	const pages = useEditor((state) => state.pages);
	const setValueAt = useEditor((state) => state.setValueAt);
	const close = useEditor((state) => state.closePageSettings);
	const index = pages.findIndex((candidate) => candidate.id === page.id);
	const suggestion = slugFromName(page.name ?? "");
	const slug = slugProblem(pages, index);
	const problem = slug ? problemText(slug) : null;
	const fields = localizedFields(PAGE_FIELDS, "page");
	const labelOf = (key: string) =>
		fields.find((field) => field.key === key)?.label ?? key;
	const rest = fields
		.filter((field) => !OWN_FIELDS.has(field.key))
		.map((field) =>
			field.key === "width"
				? {
						...field,
						help: [field.help, t("inspector.page.widthHint")]
							.filter(Boolean)
							.join(" "),
					}
				: field,
		);

	return (
		<>
			<header className="mb-4 flex items-start gap-3">
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-lg font-bold">
						{t("canvas.pageSettings")}
					</h2>
					<p className="truncate font-mono text-xs text-muted">
						<bdi>{page.name ?? t("page.untitled")}</bdi> ·{" "}
						<bdi dir="ltr">/{page.slug ?? suggestion}</bdi>
					</p>
				</div>
				<button
					type="button"
					onClick={close}
					className="cursor-pointer rounded-sm px-2 py-1 text-xs text-muted hover:text-text"
				>
					{t("common.close")}
				</button>
			</header>
			{page.include !== null ? (
				<p className="text-sm text-muted">
					<Trans
						i18nKey="inspector.page.included"
						values={{ file: page.include }}
						components={{ file: <code dir="ltr" className="font-mono" /> }}
					/>
				</p>
			) : (
				// Keyed by page: another page gets a fresh form.
				<MapForm key={page.id} basePath={page.path} fields={fields}>
					<TextField name="name" label={labelOf("name")} />
					<TextField
						name="slug"
						label={labelOf("slug")}
						placeholder={suggestion}
						hint={t("inspector.page.slugHint", { slug: suggestion })}
						mono
					/>
					{problem && <FieldWarning text={problem} />}
					{page.slug === null && suggestion !== "" && problem === null && (
						<button
							type="button"
							onClick={() => setValueAt(page.path, ["slug"], suggestion)}
							className="-mt-2 mb-4 cursor-pointer text-xs text-accent underline-offset-2 hover:underline"
						>
							{t("inspector.page.writeSlug", { slug: suggestion })}
						</button>
					)}
					<FieldList fields={rest} prefix="" />
				</MapForm>
			)}
		</>
	);
}
