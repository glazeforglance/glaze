import { getWidgetOptions, serializeConfig } from "@glaze/core";
import { WIDGET_TYPES } from "@glaze/schemas";
import { describe, expect, it } from "vitest";
import { schemaFor } from "../src/forms/registry.ts";
import { optionValues, widgetTarget } from "../src/forms/use-widget-form.ts";
import {
	createEditorStore,
	editorStore,
	selectCurrentPage,
} from "../src/store/editor-store.ts";

/*
 * Every widget fixture (packages/schemas/test/fixtures, written after Glance's
 * docs) goes through the same path the forms use: form values → core edits →
 * YAML. Nothing outside the touched value may change.
 */

// Vite reads the files as text at test time; no Node APIs needed.
const FILES = import.meta.glob<string>(
	"../../../packages/schemas/test/fixtures/*.yml",
	{ query: "?raw", import: "default", eager: true },
);
const FIXTURES = Object.entries(FILES)
	.map(([path, text]) => ({
		type: (path.split("/").pop() ?? "").replace(/\.yml$/, ""),
		text: text.replace(/\r\n/g, "\n"),
	}))
	.sort((a, b) => (a.type < b.type ? -1 : 1));

/** A config with the fixture as the only widget of a column. */
function configWith(fixture: string): string {
	const body = fixture
		.split("\n")
		.filter((line) => line !== "")
		.map((line, index) =>
			index === 0 || line.startsWith("#")
				? `          ${line.startsWith("#") ? line : `- ${line}`}`
				: `            ${line}`,
		);
	// Comment lines come first in the fixture; the item's dash goes on its first key.
	const firstKey = body.findIndex((line) => !line.trimStart().startsWith("#"));
	const lines = body.map((line, index) =>
		index === firstKey ? `          - ${line.trimStart()}` : line,
	);
	return `pages:\n  - name: Fixtures\n    columns:\n      - size: full\n        widgets:\n${lines.join("\n")}\n`;
}

const WIDGET = ["pages", 0, "columns", 0, "widgets", 0] as const;

function load(text: string) {
	const store = createEditorStore();
	store.getState().load(text, "v1");
	return store;
}

function textOf(store: ReturnType<typeof createEditorStore>): string {
	const { doc } = store.getState();
	if (!doc) throw new Error("no document");
	return serializeConfig(doc);
}

/** Every scalar leaf of a value, with its path (block scalars excluded). */
function leaves(
	value: unknown,
	path: (string | number)[] = [],
): { path: (string | number)[]; value: string | number | boolean }[] {
	if (Array.isArray(value))
		return value.flatMap((item, i) => leaves(item, [...path, i]));
	if (typeof value === "object" && value !== null) {
		return Object.entries(value).flatMap(([key, item]) =>
			leaves(item, [...path, key]),
		);
	}
	if (typeof value === "string" && value.includes("\n")) return [];
	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return [{ path, value }];
	}
	return [];
}

function changed(value: string | number | boolean): string | number | boolean {
	if (typeof value === "boolean") return !value;
	if (typeof value === "number") return value + 1;
	return `${value}-changed`;
}

describe("widget fixtures", () => {
	it("cover every widget type", () => {
		expect(FIXTURES.map((fixture) => fixture.type).sort()).toEqual(
			[...WIDGET_TYPES].sort(),
		);
	});

	describe.each(FIXTURES)("$type", ({ type, text }) => {
		const config = configWith(text);

		it("loads, and passes the form validation", () => {
			const store = load(config);
			const widget = selectCurrentPage(store.getState())?.columns[0]
				?.widgets[0];
			expect(widget?.type).toBe(type);
			const doc = store.getState().doc;
			if (!doc) throw new Error("no document");
			const options = getWidgetOptions(doc, WIDGET);
			if (!options.ok) throw new Error(options.error.message);
			const result = schemaFor(type).safeParse(
				optionValues(options.value.options),
			);
			expect(result.error?.issues ?? []).toEqual([]);
		});

		it("changes exactly one line per edited value, keeping every comment", () => {
			const store = load(config);
			const doc = store.getState().doc;
			if (!doc) throw new Error("no document");
			const options = getWidgetOptions(doc, WIDGET);
			if (!options.ok) throw new Error(options.error.message);
			const values = optionValues(options.value.options);
			const widgetId =
				selectCurrentPage(store.getState())?.columns[0]?.widgets[0]?.id ?? "";
			const comments = config.split("\n").filter((line) => line.includes("#"));
			for (const leaf of leaves(values)) {
				if (leaf.path[0] === "type" || leaf.path.includes("widgets")) continue;
				const edited = load(config);
				const before = textOf(edited);
				const ok = edited
					.getState()
					.setWidgetValue(widgetId, leaf.path, changed(leaf.value));
				expect(
					ok,
					`${type} ${leaf.path.join(".")}: ${edited.getState().notice}`,
				).toBe(true);
				const after = textOf(edited).split("\n");
				const old = before.split("\n");
				const differing = old.filter((line, i) => line !== after[i]);
				expect(after.length, leaf.path.join(".")).toBe(old.length);
				expect(differing.length, leaf.path.join(".")).toBe(1);
				for (const comment of comments) {
					expect(
						after.some((line) =>
							line.includes(comment.slice(comment.indexOf("#"))),
						),
						comment,
					).toBe(true);
				}
			}
		});

		it("can be built option by option through the form target", () => {
			const source = load(config).getState().doc;
			if (!source) throw new Error("no document");
			const wanted = getWidgetOptions(source, WIDGET);
			if (!wanted.ok) throw new Error(wanted.error.message);
			const values = optionValues(wanted.value.options);

			editorStore
				.getState()
				.load(
					"pages:\n  - name: Fixtures\n    columns:\n      - size: full\n",
					"v1",
				);
			editorStore
				.getState()
				.addWidget({ type }, ["pages", 0, "columns", 0, "widgets"], 0);
			const id =
				selectCurrentPage(editorStore.getState())?.columns[0]?.widgets[0]?.id ??
				"";
			const target = widgetTarget(id);
			for (const [key, value] of Object.entries(values)) {
				if (key === "type" || key === "widgets") continue;
				expect(target.set([key], value), `${type}.${key}`).toBe(true);
			}
			const built = { ...target.values() };
			const { widgets: _children, ...expected } = values;
			expect(built).toEqual(expected);
		});
	});
});
