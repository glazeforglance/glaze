import { CONFIG_FIELDS, type FieldSchema } from "@glaze/schemas";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { CodeField } from "../../forms/fields/CodeField.tsx";
import { MapForm } from "../../forms/MapForm.tsx";
import { FieldList, FieldWarning } from "../../forms/SchemaField.tsx";
import { useWidgetForm } from "../../forms/use-widget-form.ts";
import { useSettings } from "../../hooks/use-settings.ts";
import {
	glanceReachNotes,
	type ServerOptions,
} from "../../lib/glance-settings.ts";
import { useEditor } from "../../store/editor-store.ts";
import { AuthSection } from "./AuthSection.tsx";

type SectionId = "server" | "auth" | "document" | "branding" | "theme";

const SECTIONS: readonly { id: SectionId; label: string; text: string }[] = [
	{
		id: "server",
		label: "Server",
		text: "Where Glance listens and how it's reached.",
	},
	{
		id: "auth",
		label: "Login",
		text: "Glance's own login: users and the secret key.",
	},
	{
		id: "document",
		label: "Document head",
		text: "Extra HTML in every page's <head>.",
	},
	{
		id: "branding",
		label: "Branding",
		text: "Logo, footer, favicon and app name.",
	},
	{ id: "theme", label: "Theme", text: "Colors, contrast and theme presets." },
];

function sectionFields(key: string): readonly FieldSchema[] {
	return CONFIG_FIELDS.find((field) => field.key === key)?.fields ?? [];
}

/**
 * The Settings view: glance.yml's top-level sections (server, auth,
 * document, branding, theme) as forms. Like everything else, each change is
 * a small edit of the draft, written on Publish.
 * @returns The view.
 */
export function SettingsView() {
	const [section, setSection] = useState<SectionId>("server");
	const codeError = useEditor((state) => state.codeText !== null);
	const current = SECTIONS.find((candidate) => candidate.id === section);

	return (
		<div className="flex min-h-0 min-w-0 flex-1">
			<nav
				aria-label="Settings sections"
				className="flex w-56 shrink-0 flex-col gap-1 border-r border-line bg-bg p-3"
			>
				{SECTIONS.map((option) => (
					<button
						key={option.id}
						type="button"
						aria-current={option.id === section ? "page" : undefined}
						onClick={() => setSection(option.id)}
						className={`min-h-10 cursor-pointer rounded-sm px-3 text-left text-sm ${
							option.id === section
								? "bg-card font-semibold text-text"
								: "text-muted hover:bg-card hover:text-text"
						}`}
					>
						{option.label}
					</button>
				))}
			</nav>
			<main aria-label="Settings" className="min-w-0 flex-1 overflow-auto">
				<div className="mx-auto max-w-2xl px-6 py-8">
					<h1 className="text-2xl font-bold">{current?.label}</h1>
					<p className="mt-1 mb-6 text-sm text-muted">{current?.text}</p>
					{codeError ? (
						<FieldWarning text="The YAML in the Code view has errors. Fix them there before changing settings." />
					) : (
						<MapForm basePath={[]} fields={CONFIG_FIELDS}>
							{section === "server" && <ServerSection />}
							{section === "auth" && <AuthSection />}
							{section === "document" && <DocumentSection />}
							{section === "branding" && (
								<FieldList
									fields={sectionFields("branding")}
									prefix="branding"
								/>
							)}
							{section === "theme" && (
								<FieldList fields={sectionFields("theme")} prefix="theme" />
							)}
						</MapForm>
					)}
				</div>
			</main>
		</div>
	);
}

function ServerSection() {
	const { form } = useWidgetForm();
	const server: unknown = useWatch({ control: form.control, name: "server" });
	const settings = useSettings();
	const notes =
		settings.status === "ready"
			? glanceReachNotes(
					settings.settings.glanceUrl,
					typeof server === "object" && server !== null
						? (server as ServerOptions)
						: {},
				)
			: [];
	return (
		<>
			{notes.map((note) => (
				<FieldWarning key={note} text={note} />
			))}
			<FieldList fields={sectionFields("server")} prefix="server" />
		</>
	);
}

function DocumentSection() {
	return (
		<>
			<FieldWarning text="Scripts here run on every page of your dashboard, for everyone who opens it. Only add code you trust." />
			<CodeField
				name="document.head"
				label="Extra <head> HTML"
				language="html"
				hint="E.g. a <link> to a font, a <meta> tag, or a script such as Glaze's Edit page button."
			/>
		</>
	);
}
