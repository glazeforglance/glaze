import { describe, expect, it } from "vitest";
import {
	BASE_FIELDS,
	CONFIG_FIELDS,
	listItemLabel,
	localizeFields,
	localizeWidget,
	PAGE_FIELDS,
	schemaTexts,
	type TextTree,
	WIDGET_SCHEMAS,
	WIDGET_TYPES,
	widgetSchema,
} from "../src/index.ts";

const SET = {
	base: BASE_FIELDS,
	page: PAGE_FIELDS,
	config: CONFIG_FIELDS,
	widgets: WIDGET_TYPES.flatMap((type) => {
		const schema = WIDGET_SCHEMAS[type];
		return schema ? [schema] : [];
	}),
};

function lookup(tree: TextTree, key: string): string | undefined {
	let node: string | TextTree | undefined = tree;
	for (const part of key.split(".")) {
		if (typeof node !== "object") return undefined;
		node = node[part];
	}
	return typeof node === "string" ? node : undefined;
}

describe("schemaTexts", () => {
	const texts = schemaTexts(SET);

	it("keys widget texts by type and field", () => {
		expect(lookup(texts, "widget.weather.name")).toBe("Weather");
		expect(lookup(texts, "widget.weather.fields.location.label")).toBe(
			"Location",
		);
		expect(lookup(texts, "base.hide-header.label")).toBe("Hide the header");
		expect(lookup(texts, "page.width.options.slim.label")).toBe("Slim");
	});

	it("keeps a field named `label` apart from its texts", () => {
		// Children sit under `fields`, so a Glance option called "label" can't clash.
		const keys = Object.keys(texts.widget as TextTree);
		expect(keys).toContain("bookmarks");
		expect(
			lookup(texts, "widget.bookmarks.fields.groups.item.fields.links.label"),
		).toBe("Links");
	});

	it("names list items", () => {
		expect(lookup(texts, "widget.monitor.fields.sites.item.label")).toBe(
			"Site",
		);
	});
});

describe("listItemLabel", () => {
	it("makes the list's label singular", () => {
		const sites = widgetSchema("monitor")?.fields.find(
			(field) => field.key === "sites",
		);
		expect(sites && listItemLabel(sites)).toBe("Site");
	});
});

describe("localize", () => {
	const upper = (_key: string, fallback: string) => fallback.toUpperCase();

	it("reads every text through the same keys", () => {
		const seen: string[] = [];
		const weather = widgetSchema("weather");
		if (!weather) throw new Error("no weather schema");
		const localized = localizeWidget(weather, (key, fallback) => {
			seen.push(key);
			return fallback;
		});
		expect(localized).toEqual({
			...weather,
			fields: localized.fields,
			groups: localized.groups,
		});
		const texts = schemaTexts(SET);
		for (const key of seen) {
			expect(lookup(texts, key), key).toBeDefined();
		}
	});

	it("translates labels and leaves keys and values alone", () => {
		const [width] = localizeFields(
			PAGE_FIELDS.filter((field) => field.key === "width"),
			"page",
			upper,
		);
		expect(width?.key).toBe("width");
		expect(width?.label).toBe("WIDTH");
		expect(width?.options?.map((option) => option.value)).toEqual([
			"default",
			"slim",
			"wide",
		]);
	});
});
