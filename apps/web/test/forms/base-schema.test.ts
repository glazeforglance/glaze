import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formFor, schemaFor } from "../../src/forms/registry.ts";
import {
	baseWidgetSchema,
	isEnvReference,
	orEnv,
} from "../../src/forms/schema.ts";
import { validateField } from "../../src/forms/validate.ts";

describe("baseWidgetSchema", () => {
	it("accepts the shared widget options", () => {
		const result = baseWidgetSchema.safeParse({
			type: "clock",
			title: "Clock",
			"title-url": "https://time.example.test",
			cache: "5m",
			"hide-header": true,
			"css-class": "my-card",
		});
		expect(result.success).toBe(true);
	});

	it("allows unknown keys and keeps them", () => {
		const result = baseWidgetSchema.safeParse({
			type: "clock",
			"hour-format": "24h",
		});
		expect(result.success && result.data["hour-format"]).toBe("24h");
	});

	it("allows cleared optional fields and ${ENV} values", () => {
		expect(
			baseWidgetSchema.safeParse({ type: "rss", title: "", cache: "" }).success,
		).toBe(true);
		expect(
			baseWidgetSchema.safeParse({ type: "rss", cache: "${RSS_CACHE}" })
				.success,
		).toBe(true);
	});

	it("gives a readable error for a bad duration", () => {
		const result = baseWidgetSchema.safeParse({
			type: "rss",
			cache: "5 minutes",
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toBe(
			"Use a number and a unit: 30s, 5m, 1h or 1d",
		);
		expect(result.error?.issues[0]?.path).toEqual(["cache"]);
	});
});

describe("orEnv", () => {
	it("passes a variable, and the wrapped schema's own message otherwise", () => {
		const schema = orEnv(z.number({ error: "Must be a number" }));
		expect(schema.safeParse("${LIMIT}").success).toBe(true);
		expect(schema.safeParse(3).success).toBe(true);
		expect(schema.safeParse("three").error?.issues[0]?.message).toBe(
			"Must be a number",
		);
	});

	it("only counts a whole, real reference as a variable", () => {
		expect(isEnvReference("${TOKEN}")).toBe(true);
		expect(isEnvReference("Bearer ${TOKEN}")).toBe(false);
		expect(isEnvReference("${lower}")).toBe(false);
	});
});

describe("validateField", () => {
	const schema = z.looseObject({
		cache: z
			.string()
			.regex(/^\d+m$/, "Minutes only")
			.optional(),
		sites: z.array(
			z.looseObject({ url: z.string().min(1, "A site needs a URL") }),
		),
	});

	it("reports the field's own problem", () => {
		expect(validateField(schema, { sites: [] }, ["cache"], "1h")).toBe(
			"Minutes only",
		);
		expect(
			validateField(
				schema,
				{ sites: [{ url: "https://a.test" }] },
				["sites", 0, "url"],
				"",
			),
		).toBe("A site needs a URL");
	});

	it("ignores problems elsewhere in the widget", () => {
		// A hand-written bad value in another field must not block this one.
		expect(
			validateField(schema, { cache: "1h", sites: [] }, ["sites"], []),
		).toBeNull();
	});
});

describe("registry", () => {
	it("falls back to the shared schema for types without a form", () => {
		expect(formFor("some-future-widget")).toBeNull();
		expect(formFor("constructor")).toBeNull();
		expect(formFor(null)).toBeNull();
		expect(schemaFor("some-future-widget")).toBe(baseWidgetSchema);
	});
});
