import {
	BASE_FIELDS,
	type FieldSchema,
	WIDGET_SCHEMAS,
	WIDGET_TYPES,
} from "@glaze/schemas";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FieldProbeContext } from "../../src/forms/field-probe.ts";
import { WidgetForm } from "../../src/forms/WidgetForm.tsx";
import { findWidget } from "../../src/lib/model.ts";
import {
	editorStore,
	selectCurrentPage,
} from "../../src/store/editor-store.ts";

/*
 * Every option the generator found must be reachable in some form: render
 * every widget's Settings and Style tabs with every option filled in, record
 * which fields the forms show, and compare with the schemas. Options marked
 * `hidden` (with a reason) and child widgets (edited on the canvas) are the
 * only ones allowed to be missing.
 */

// A server render sees a Zustand store's initial state (its server
// snapshot); this one-off render should see the live state instead.
vi.mock("zustand", async (importOriginal) => {
	const actual = await importOriginal<typeof import("zustand")>();
	return {
		...actual,
		useStore: <S, U>(
			api: { getState(): S },
			selector: (state: S) => U = (state) => state as unknown as U,
		) => selector(api.getState()),
	};
});

const BASE = "pages:\n  - name: Coverage\n    columns:\n      - size: full\n";

/** A value for every field, so lists, maps and objects render their insides. */
function sample(field: FieldSchema): unknown {
	switch (field.kind) {
		case "boolean":
			return true;
		case "number":
			return 1.5;
		case "integer":
			return 1;
		case "duration":
			return "1m";
		case "color":
			return "1 2 3";
		case "icon":
			return "si:glance";
		case "enum":
			return field.options?.[0]?.value ?? "x";
		case "list":
			return field.item ? [sample(field.item)] : [];
		case "map":
			return field.item ? { sample: sample(field.item) } : {};
		case "object":
			return Object.fromEntries(
				(field.fields ?? []).map((child) => [child.key, sample(child)]),
			);
		case "union": {
			// The object form reaches the most fields.
			const variant =
				field.variants?.find((candidate) => candidate.kind === "object") ??
				field.variants?.[0];
			return variant ? sample(variant) : "x";
		}
		default:
			return "x";
	}
}

/** Every path a form should reach: `sites`, `sites.[].url`, `subrequests.*.url`, … */
function expectedPaths(fields: readonly FieldSchema[], prefix = ""): string[] {
	return fields.flatMap((field) => {
		if (field.hidden || field.kind === "widgets") return [];
		const path = prefix + field.key;
		return [path, ...childPaths(field, path)];
	});
}

function childPaths(field: FieldSchema, path: string): string[] {
	if (field.kind === "object")
		return expectedPaths(field.fields ?? [], `${path}.`);
	if (field.kind === "union") {
		return (field.variants ?? []).flatMap((variant) =>
			variant.kind === "object"
				? expectedPaths(variant.fields ?? [], `${path}.`)
				: [],
		);
	}
	if ((field.kind === "list" || field.kind === "map") && field.item) {
		// A list of numbers is one comma-separated field (e.g. "401, 403"): its items are in it.
		const numbers =
			field.item.kind === "integer" || field.item.kind === "number";
		if (field.kind === "list" && numbers) return [];
		const step = `${path}.${field.kind === "list" ? "[]" : "*"}`;
		return field.item.kind === "object"
			? expectedPaths(field.item.fields ?? [], `${step}.`)
			: [step, ...childPaths(field.item, step)];
	}
	return [];
}

/** Turns a rendered field name (`sites.0.url`) into a schema path (`sites.[].url`). */
function schemaPath(
	fields: readonly FieldSchema[],
	name: string,
): string | null {
	const segments = name.split(".");
	let current: FieldSchema | undefined;
	const out: string[] = [];
	for (const segment of segments) {
		if (!current) {
			current = fields.find((field) => field.key === segment);
			out.push(segment);
		} else if (current.kind === "list") {
			current = current.item;
			out.push("[]");
		} else if (current.kind === "map") {
			current = current.item;
			out.push("*");
		} else {
			const inObject: FieldSchema | undefined =
				current.kind === "object"
					? current.fields?.find((field) => field.key === segment)
					: current.variants
							?.find((variant) => variant.kind === "object")
							?.fields?.find((field) => field.key === segment);
			current = inObject;
			out.push(segment);
		}
		if (!current) return null;
	}
	return out.join(".");
}

function renderedNames(type: string): Set<string> {
	const schema = WIDGET_SCHEMAS[type];
	if (!schema) throw new Error(`no schema for ${type}`);
	editorStore.getState().load(BASE, "v1");
	const widget = Object.fromEntries(
		schema.fields
			.filter((field) => field.kind !== "widgets")
			.map((field) => [field.key, sample(field)]),
	);
	editorStore.getState().addWidget(
		{
			type,
			title: "x",
			"title-url": "https://example.test",
			cache: "1h",
			"hide-header": true,
			"css-class": "x",
			...widget,
		},
		["pages", 0, "columns", 0, "widgets"],
		0,
	);
	const page = selectCurrentPage(editorStore.getState());
	const added = page?.columns[0]?.widgets[0];
	if (!added || !page || !findWidget(page, added.id)) {
		throw new Error(
			`${type}: the sample widget wasn't added (${editorStore.getState().notice})`,
		);
	}
	const seen = new Set<string>();
	for (const tab of ["settings", "style"] as const) {
		renderToString(
			createElement(
				FieldProbeContext,
				{ value: { seen } },
				createElement(WidgetForm, { widget: added, tab, onShowYaml: () => {} }),
			),
		);
	}
	return seen;
}

describe("form coverage", () => {
	it.each(WIDGET_TYPES)("every %s option is reachable in a form", (type) => {
		const schema = WIDGET_SCHEMAS[type];
		const fields = [...BASE_FIELDS, ...(schema?.fields ?? [])];
		const covered = new Set<string>();
		for (const name of renderedNames(type)) {
			const path = schemaPath(fields, name);
			if (path === null) continue;
			// A field inside a container shows that the container is reachable too.
			const parts = path.split(".");
			for (let end = 1; end <= parts.length; end += 1) {
				covered.add(parts.slice(0, end).join("."));
			}
		}
		const missing = expectedPaths(fields)
			.filter((path) => !covered.has(path))
			// Group and split-column hide the header options Glance ignores for them.
			.filter(
				(path) =>
					!(
						(type === "group" || type === "split-column") &&
						["title", "title-url", "cache", "hide-header"].includes(path)
					),
			);
		expect(missing).toEqual([]);
	});

	it("knows every option's place, hidden ones with a reason", () => {
		for (const type of WIDGET_TYPES) {
			for (const field of WIDGET_SCHEMAS[type]?.fields ?? []) {
				if (field.hidden !== undefined)
					expect(field.hidden.length, `${type}.${field.key}`).toBeGreaterThan(
						10,
					);
			}
		}
	});
});
