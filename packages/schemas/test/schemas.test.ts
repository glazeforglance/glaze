import { describe, expect, it } from "vitest";
import {
	BASE_FIELDS,
	CONFIG_FIELDS,
	type FieldSchema,
	fieldAt,
	GENERATED_FROM,
	knownWidgetKeys,
	PAGE_FIELDS,
	WIDGET_SCHEMAS,
	WIDGET_TYPES,
	widgetSchema,
} from "../src/index.ts";

/** Every field in a tree, with its path. */
function walk(
	fields: readonly FieldSchema[],
	where: string,
): [string, FieldSchema][] {
	return fields.flatMap((field) => {
		const path = `${where}.${field.key || "·"}`;
		return [
			[path, field] as [string, FieldSchema],
			...walk(field.fields ?? [], path),
			...(field.item ? walk([field.item], path) : []),
			...walk(field.variants ?? [], path),
		];
	});
}

const ALL: [string, FieldSchema][] = [
	...walk(BASE_FIELDS, "widgetBase"),
	...WIDGET_TYPES.flatMap((type) =>
		walk(WIDGET_SCHEMAS[type]?.fields ?? [], type),
	),
	...walk(PAGE_FIELDS, "page"),
	...walk(CONFIG_FIELDS, "config"),
];

describe("generated schemas", () => {
	it("come from Glance v0.8.7 and cover all 28 widget types", () => {
		expect(GENERATED_FROM).toBe("v0.8.7");
		expect(WIDGET_TYPES).toHaveLength(28);
		expect(WIDGET_TYPES).toContain("calendar-legacy");
		expect(widgetSchema("stocks")).toBe(widgetSchema("markets"));
		expect(widgetSchema("nope")).toBeNull();
		expect(widgetSchema("constructor")).toBeNull();
	});

	it("give every field a label and a known kind", () => {
		for (const [path, field] of ALL) {
			if (field.key !== "") expect(field.label, path).not.toBe("");
			expect(field.kind, path).toMatch(
				/^(text|multiline|url|number|integer|boolean|duration|enum|list|object|map|union|icon|color|secret|code|any|widgets)$/,
			);
		}
	});

	it("describe the structure every kind needs", () => {
		for (const [path, field] of ALL) {
			if (field.kind === "enum")
				expect(field.options?.length, path).toBeGreaterThan(0);
			if (field.kind === "list" || field.kind === "map")
				expect(field.item, path).toBeDefined();
			if (field.kind === "object") expect(field.fields, path).toBeDefined();
			if (field.kind === "union")
				expect(field.variants?.length, path).toBeGreaterThan(1);
		}
	});

	it("have no duplicate keys in one object", () => {
		const lists: (readonly FieldSchema[])[] = [
			BASE_FIELDS,
			PAGE_FIELDS,
			CONFIG_FIELDS,
			...WIDGET_TYPES.map((type) => WIDGET_SCHEMAS[type]?.fields ?? []),
			...ALL.map(([, field]) => field.fields ?? []),
		];
		for (const fields of lists) {
			const keys = fields.map((field) => field.key);
			expect(new Set(keys).size).toBe(keys.length);
		}
	});

	it("handle the custom YAML types explicitly", () => {
		const releases = widgetSchema("releases")?.fields ?? [];
		expect(fieldAt(releases, ["repositories", 0])?.kind).toBe("union");
		const reddit = widgetSchema("reddit")?.fields ?? [];
		expect(fieldAt(reddit, ["proxy"])?.variants?.map((v) => v.kind)).toEqual([
			"url",
			"object",
		]);
		const monitor = widgetSchema("monitor")?.fields ?? [];
		expect(fieldAt(monitor, ["sites", 0, "timeout"])?.kind).toBe("duration");
		expect(fieldAt(monitor, ["sites", 0, "icon"])?.kind).toBe("icon");
		expect(fieldAt(monitor, ["sites", 0, "basic-auth", "password"])?.kind).toBe(
			"secret",
		);
		const bookmarks = widgetSchema("bookmarks")?.fields ?? [];
		expect(fieldAt(bookmarks, ["groups", 0, "color"])?.kind).toBe("color");
		const custom = widgetSchema("custom-api")?.fields ?? [];
		expect(fieldAt(custom, ["body"])?.kind).toBe("any");
		expect(fieldAt(custom, ["parameters", "q"])?.kind).toBe("union");
		expect(fieldAt(custom, ["subrequests", "stats", "url"])?.kind).toBe("url");
		expect(fieldAt(custom, ["template"])?.language).toBe("go-template");
		expect(fieldAt(BASE_FIELDS, ["cache"])?.kind).toBe("duration");
	});

	it("read defaults, enums and required fields from the Glance code", () => {
		const clock = widgetSchema("clock")?.fields ?? [];
		expect(fieldAt(clock, ["hour-format"])).toMatchObject({
			kind: "enum",
			default: "24h",
		});
		expect(fieldAt(clock, ["timezones", 0, "timezone"])?.required).toBe(true);
		const calendar = widgetSchema("calendar")?.fields ?? [];
		expect(fieldAt(calendar, ["first-day-of-week"])?.options).toHaveLength(7);
		const search = widgetSchema("search")?.fields ?? [];
		expect(fieldAt(search, ["search-engine"])?.allowCustom).toBe(true);
		const dns = widgetSchema("dns-stats")?.fields ?? [];
		expect(fieldAt(dns, ["service"])?.options?.map((o) => o.value)).toEqual([
			"adguard",
			"pihole-v6",
			"pihole",
			"technitium",
		]);
		const servers = widgetSchema("server-stats")?.fields ?? [];
		expect(fieldAt(servers, ["servers", 0, "timeout"])?.default).toBe("3s");
		expect(
			fieldAt(servers, ["servers", 0, "mountpoints", "/mnt", "hide"])?.kind,
		).toBe("boolean");
		expect(widgetSchema("hacker-news")?.defaultCache).toBe("30m");
		expect(widgetSchema("weather")?.defaultCache).toBe("on the hour");
		expect(
			fieldAt(widgetSchema("weather")?.fields ?? [], ["location"])?.required,
		).toBe(true);
	});

	it("list every option for the unknown-option check", () => {
		const keys = knownWidgetKeys();
		expect(keys.base).toEqual([
			"type",
			"title",
			"title-url",
			"hide-header",
			"css-class",
			"cache",
		]);
		expect(keys.types.stocks).toEqual(keys.types.markets);
		expect(keys.types["custom-api"]).toContain("subrequests");
	});

	it("start new widgets with only options their schema knows", () => {
		for (const type of WIDGET_TYPES) {
			const schema = WIDGET_SCHEMAS[type];
			for (const key of Object.keys(schema?.newWidget ?? {})) {
				expect(
					schema?.fields.map((field) => field.key),
					`${type}.${key}`,
				).toContain(key);
			}
		}
	});
});
