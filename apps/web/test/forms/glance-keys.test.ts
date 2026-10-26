import { WIDGET_BASE_KEYS, WIDGET_TYPE_KEYS } from "@glaze/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FORM_TYPES, formFor } from "../../src/forms/registry.ts";

// The server warns about unknown options using the key lists in @glaze/core.
// These must match the form schemas, or valid options would get a warning.
describe("known Glance keys in @glaze/core", () => {
	it("cover every widget that has a form", () => {
		for (const type of FORM_TYPES) {
			expect(Object.hasOwn(WIDGET_TYPE_KEYS, type), type).toBe(true);
		}
	});

	it.each(FORM_TYPES)("match the %s schema", (type) => {
		const schema = formFor(type)?.schema;
		if (!(schema instanceof z.ZodObject))
			throw new Error(`${type}: no object schema`);
		const schemaKeys = Object.keys(schema.shape).sort();
		// Child widgets are a structural key, not a form field.
		const coreKeys = [...WIDGET_BASE_KEYS, ...(WIDGET_TYPE_KEYS[type] ?? [])]
			.filter((key) => key !== "widgets")
			.sort();
		expect(schemaKeys).toEqual(coreKeys);
	});
});
