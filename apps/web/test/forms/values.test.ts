import { widgetSchema } from "@glaze/schemas";
import { describe, expect, it } from "vitest";
import {
	formatHsl,
	hexToHsl,
	hslToHex,
	parseHsl,
} from "../../src/lib/color.ts";
import {
	convertShape,
	convertVariant,
	formatIcon,
	itemName,
	newValue,
	parseIcon,
	shapeOf,
	variantIndex,
} from "../../src/forms/values.ts";

describe("HSL colors", () => {
	it("reads both forms Glance accepts", () => {
		expect(parseHsl("240 13 14")).toEqual({ h: 240, s: 13, l: 14 });
		expect(parseHsl("hsl(240, 13%, 14%)")).toEqual({ h: 240, s: 13, l: 14 });
		expect(parseHsl("400 13 14")).toBeNull();
		expect(parseHsl("blue")).toBeNull();
	});

	it("converts to hex and back", () => {
		expect(hslToHex({ h: 0, s: 100, l: 50 })).toBe("#ff0000");
		expect(hslToHex({ h: 240, s: 13, l: 14 })).toBe("#1f1f28");
		const back = hexToHsl("#1f1f28");
		expect(back && formatHsl(back)).toBe("240 13 14");
		expect(hexToHsl("#fff")).toEqual({ h: 0, s: 0, l: 100 });
		expect(hexToHsl("nope")).toBeNull();
	});
});

describe("icons", () => {
	it("splits and joins the forms Glance reads", () => {
		expect(parseIcon("si:jellyfin")).toEqual({
			source: "si",
			name: "jellyfin",
			autoInvert: false,
		});
		expect(parseIcon("auto-invert di:immich.png")).toEqual({
			source: "di",
			name: "immich.png",
			autoInvert: true,
		});
		expect(parseIcon("https://example.com/a.svg")).toEqual({
			source: "url",
			name: "https://example.com/a.svg",
			autoInvert: false,
		});
		expect(formatIcon({ source: "sh", name: "glance", autoInvert: true })).toBe(
			"auto-invert sh:glance",
		);
		expect(formatIcon({ source: "url", name: " ", autoInvert: false })).toBe(
			"",
		);
	});
});

describe("any values", () => {
	it("tells the shape of a value and converts between shapes", () => {
		expect(shapeOf([1])).toBe("list");
		expect(shapeOf({ a: 1 })).toBe("map");
		expect(shapeOf("1")).toBe("text");
		expect(convertShape("42", "number")).toBe(42);
		expect(convertShape("x", "number")).toBe(0);
		expect(convertShape(7, "text")).toBe("7");
		expect(convertShape("true", "boolean")).toBe(true);
		expect(convertShape("a", "list")).toEqual(["a"]);
		expect(convertShape([1], "map")).toEqual({});
	});
});

describe("union variants", () => {
	const repositories = widgetSchema("releases")?.fields.find(
		(field) => field.key === "repositories",
	)?.item;

	it("picks the variant that matches the value", () => {
		if (!repositories) throw new Error("no repositories field");
		expect(variantIndex(repositories, "glanceapp/glance")).toBe(0);
		expect(variantIndex(repositories, { repository: "a/b" })).toBe(1);
	});

	it("moves a plain value into the object's main field and back", () => {
		if (!repositories) throw new Error("no repositories field");
		expect(convertVariant(repositories, "glanceapp/glance", 1)).toEqual({
			repository: "glanceapp/glance",
		});
		expect(
			convertVariant(
				repositories,
				{ repository: "a/b", "include-prereleases": true },
				0,
			),
		).toBe("a/b");
	});
});

describe("list items", () => {
	it("names an item by its most telling field", () => {
		expect(itemName({ url: "https://a", title: "A" }, "Site 1")).toBe("A");
		expect(itemName({ symbol: "SPY" }, "Market 1")).toBe("SPY");
		expect(itemName({}, "Site 1")).toBe("Site 1");
		expect(itemName("owner/repo", "Repository 1")).toBe("owner/repo");
	});

	it("starts new items with a non-empty value", () => {
		const sites = widgetSchema("monitor")?.fields.find(
			(f) => f.key === "sites",
		);
		if (!sites?.item) throw new Error("no sites field");
		expect(newValue(sites.item)).toEqual({ url: "https://example.com" });
		const feeds = widgetSchema("rss")?.fields.find((f) => f.key === "feeds");
		if (!feeds?.item) throw new Error("no feeds field");
		expect(newValue(feeds.item)).toEqual({ url: "https://example.com" });
		const bangs = widgetSchema("search")?.fields.find((f) => f.key === "bangs");
		if (!bangs?.item) throw new Error("no bangs field");
		expect(newValue(bangs.item)).toEqual({ shortcut: "!yt" });
	});
});
