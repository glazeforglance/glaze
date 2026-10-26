import { describe, expect, it } from "vitest";
import { fromNumberList, toNumberList } from "../../src/forms/convert.ts";
import { checkNewMapKey, isFormSafeKey } from "../../src/forms/map-keys.ts";
import { itemText } from "../../src/forms/widgets/item-text.ts";

describe("number lists", () => {
	it("turns text into numbers and back", () => {
		expect(toNumberList("401, 403 418")).toEqual([401, 403, 418]);
		expect(fromNumberList([401, 403])).toBe("401, 403");
	});

	it("keeps bad parts as text for the schema, and clears on empty", () => {
		expect(toNumberList("401, x")).toEqual([401, "x"]);
		expect(toNumberList(" , ")).toBe("");
		expect(fromNumberList("401, 4")).toBe("401, 4");
		expect(fromNumberList(undefined)).toBe("");
	});
});

describe("map keys", () => {
	it("refuses keys the form can't address", () => {
		expect(isFormSafeKey("jellyfin")).toBe(true);
		expect(isFormSafeKey("my.app")).toBe(false);
		expect(isFormSafeKey("123")).toBe(false);
	});

	it("checks a new key", () => {
		expect(checkNewMapKey(" jellyfin ", [])).toBeNull();
		expect(checkNewMapKey("", [])).toBe("Enter a name first.");
		expect(checkNewMapKey("sonarr", ["sonarr"])).toBe(
			'"sonarr" is already in the list.',
		);
		expect(checkNewMapKey("my.app", [])).toMatch(/YAML tab/);
	});
});

describe("itemText", () => {
	it("reads list item headers", () => {
		expect(itemText({ title: "Immich" }, "title")).toBe("Immich");
		expect(itemText({ title: " " }, "title")).toBeNull();
		expect(itemText("glanceapp/glance")).toBe("glanceapp/glance");
		expect(itemText({ limit: 5 }, "limit")).toBe("5");
		expect(itemText(null, "title")).toBeNull();
	});
});
