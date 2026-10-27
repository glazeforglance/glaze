import { WIDGET_TYPES } from "@glaze/schemas";
import { describe, expect, it } from "vitest";
import {
	badgeToneFor,
	catalogEntry,
	newWidgetOf,
	searchCatalog,
	WIDGET_CATALOG,
} from "../src/lib/widget-catalog.ts";

describe("catalogEntry", () => {
	it("returns known widget types", () => {
		expect(catalogEntry("monitor")).toMatchObject({
			label: "Monitor",
			abbr: "MO",
			group: "server",
		});
	});

	it("makes up an entry for unknown types", () => {
		expect(catalogEntry("future-widget")).toEqual({
			type: "future-widget",
			label: "future-widget",
			abbr: "FU",
			group: "advanced",
		});
		expect(catalogEntry(null)).toMatchObject({ label: "Unknown", abbr: "UN" });
	});
});

describe("badgeToneFor", () => {
	it("uses the color of the widget's group", () => {
		expect(badgeToneFor("clock")).toBe("accent");
		expect(badgeToneFor("monitor")).toBe("success");
		expect(badgeToneFor("rss")).toBe("info");
		expect(badgeToneFor("custom-api")).toBe("violet");
		expect(badgeToneFor("something-new")).toBe("violet");
	});
});

describe("searchCatalog", () => {
	it("returns all groups in order for an empty query", () => {
		const groups = searchCatalog("  ");
		expect(groups.map(({ group }) => group.label)).toEqual([
			"Basics",
			"Server",
			"Media & news",
			"Advanced",
		]);
		expect(groups.flatMap(({ entries }) => entries)).toHaveLength(
			WIDGET_CATALOG.length,
		);
	});

	it("matches labels case-insensitively and types, dropping empty groups", () => {
		expect(searchCatalog("DOCKER")).toMatchObject([
			{ group: { id: "server" }, entries: [{ type: "docker-containers" }] },
		]);
		expect(
			searchCatalog("split-col").flatMap(({ entries }) =>
				entries.map((e) => e.type),
			),
		).toEqual(["split-column"]);
		expect(searchCatalog("nothing like this")).toEqual([]);
	});

	it("has unique widget types", () => {
		const types = WIDGET_CATALOG.map((entry) => entry.type);
		expect(new Set(types).size).toBe(types.length);
	});

	it("lists every widget type Glance has", () => {
		const types = WIDGET_CATALOG.map((entry) => entry.type).sort();
		expect(types).toEqual([...WIDGET_TYPES].sort());
	});
});

describe("newWidgetOf", () => {
	it("starts from the schema's starting options, without a title", () => {
		expect(newWidgetOf("weather")).toEqual({
			type: "weather",
			location: "London, United Kingdom",
		});
		expect(newWidgetOf("clock")).toEqual({ type: "clock" });
		expect(newWidgetOf("future-widget")).toEqual({ type: "future-widget" });
	});
});
