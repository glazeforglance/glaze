import { describe, expect, it } from "vitest";
import { toNumber } from "../../src/forms/convert.ts";
import { toFieldName, toSubPath, valueAt } from "../../src/forms/paths.ts";

describe("field names and paths", () => {
	it("converts between field names and sub-paths", () => {
		expect(toSubPath("sites.2.url")).toEqual(["sites", 2, "url"]);
		expect(toSubPath("title-url")).toEqual(["title-url"]);
		expect(toFieldName(["groups", 0, "links", 3, "url"])).toBe(
			"groups.0.links.3.url",
		);
	});

	it("reads nested values and stops at missing steps", () => {
		const data = { sites: [{ url: "https://a.test" }], title: "X" };
		expect(valueAt(data, ["sites", 0, "url"])).toBe("https://a.test");
		expect(valueAt(data, ["sites", 1, "url"])).toBeUndefined();
		expect(valueAt(data, ["title", "deeper"])).toBeUndefined();
		expect(valueAt(data, ["sites", "url"])).toBeUndefined();
	});
});

describe("toNumber", () => {
	it("converts digits and keeps everything else as text", () => {
		expect(toNumber(" 42 ")).toBe(42);
		expect(toNumber("-1.5")).toBe(-1.5);
		expect(toNumber("")).toBe("");
		expect(toNumber("${LIMIT}")).toBe("${LIMIT}");
		expect(toNumber("ten")).toBe("ten");
	});
});
