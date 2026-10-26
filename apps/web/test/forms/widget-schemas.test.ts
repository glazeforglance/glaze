import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { FORM_TYPES, formFor, schemaFor } from "../../src/forms/registry.ts";
import { validateField } from "../../src/forms/validate.ts";
import { bookmarksSchema } from "../../src/forms/widgets/bookmarks.schema.ts";
import { calendarSchema } from "../../src/forms/widgets/calendar.schema.ts";
import { clockSchema } from "../../src/forms/widgets/clock.schema.ts";
import { dockerContainersSchema } from "../../src/forms/widgets/docker-containers.schema.ts";
import { groupSchema } from "../../src/forms/widgets/group.schema.ts";
import { monitorSchema } from "../../src/forms/widgets/monitor.schema.ts";
import { releasesSchema } from "../../src/forms/widgets/releases.schema.ts";
import { rssSchema } from "../../src/forms/widgets/rss.schema.ts";
import { searchSchema } from "../../src/forms/widgets/search.schema.ts";
import { weatherSchema } from "../../src/forms/widgets/weather.schema.ts";

/** One case per widget: a valid config, an invalid one and its message. */
interface SchemaCase {
	readonly type: string;
	readonly schema: z.ZodType;
	readonly valid: Record<string, unknown>;
	readonly invalid: Record<string, unknown>;
	readonly message: string;
	readonly path: readonly (string | number)[];
}

// Every value is fake.
const CASES: readonly SchemaCase[] = [
	{
		type: "clock",
		schema: clockSchema,
		valid: {
			type: "clock",
			"hour-format": "12h",
			timezones: [{ timezone: "Europe/Amsterdam", label: "Thuis" }],
		},
		invalid: { type: "clock", "hour-format": "25h" },
		message: "Use one of: 12h, 24h",
		path: ["hour-format"],
	},
	{
		type: "weather",
		schema: weatherSchema,
		valid: {
			type: "weather",
			location: "Amsterdam, Netherlands",
			units: "imperial",
		},
		invalid: { type: "weather", location: "  " },
		message: "Enter a location, e.g. Amsterdam, Netherlands",
		path: ["location"],
	},
	{
		type: "calendar",
		schema: calendarSchema,
		valid: { type: "calendar", "first-day-of-week": "sunday" },
		invalid: { type: "calendar", "first-day-of-week": "funday" },
		message:
			"Use one of: monday, tuesday, wednesday, thursday, friday, saturday, sunday",
		path: ["first-day-of-week"],
	},
	{
		type: "search",
		schema: searchSchema,
		valid: {
			type: "search",
			"search-engine": "https://search.example.test/?q={QUERY}",
			bangs: [
				{
					title: "YouTube",
					shortcut: "!yt",
					url: "https://yt.example.test/?q={QUERY}",
				},
			],
		},
		invalid: {
			type: "search",
			"search-engine": "https://search.example.test/",
		},
		message: "Pick an engine, or enter a URL with {QUERY} in it",
		path: ["search-engine"],
	},
	{
		type: "bookmarks",
		schema: bookmarksSchema,
		valid: {
			type: "bookmarks",
			groups: [
				{
					title: "Media",
					color: "240 13 95",
					links: [{ title: "Sonarr", url: "https://sonarr.example.test" }],
				},
			],
		},
		invalid: {
			type: "bookmarks",
			groups: [{ links: [{ title: "Sonarr", url: "sonarr.example.test" }] }],
		},
		message: "A link needs a URL that starts with http:// or https://",
		path: ["groups", 0, "links", 0, "url"],
	},
	{
		type: "monitor",
		schema: monitorSchema,
		valid: {
			type: "monitor",
			style: "compact",
			sites: [
				{
					title: "Immich",
					url: "https://immich.example.test",
					"check-url": "http://immich:2283/api/server/ping",
					timeout: "5s",
					"alt-status-codes": [401, 403],
					"basic-auth": { username: "admin", password: "${IMMICH_PASSWORD}" },
				},
			],
		},
		invalid: { type: "monitor", sites: [{ title: "Immich", url: "" }] },
		message: "A site needs a URL that starts with http:// or https://",
		path: ["sites", 0, "url"],
	},
	{
		type: "rss",
		schema: rssSchema,
		valid: {
			type: "rss",
			style: "horizontal-cards",
			limit: 10,
			"collapse-after": -1,
			feeds: [{ url: "https://feeds.example.test/rss", title: "News" }],
		},
		invalid: { type: "rss", "collapse-after": -2 },
		message: "Use -1 or more",
		path: ["collapse-after"],
	},
	{
		type: "releases",
		schema: releasesSchema,
		valid: {
			type: "releases",
			token: "${GITHUB_TOKEN}",
			repositories: [
				"glanceapp/glance",
				"gitlab:owner/project",
				{ repository: "immich-app/immich", "include-prereleases": true },
			],
		},
		invalid: { type: "releases", repositories: ["sourceforge:owner/project"] },
		message:
			"Start with github:, gitlab:, dockerhub: or codeberg:, or leave the prefix out",
		path: ["repositories", 0],
	},
	{
		type: "docker-containers",
		schema: dockerContainersSchema,
		valid: {
			type: "docker-containers",
			"running-only": true,
			containers: {
				jellyfin: {
					name: "Jellyfin",
					url: "https://jellyfin.example.test",
					hide: false,
				},
			},
		},
		invalid: {
			type: "docker-containers",
			containers: { jellyfin: { url: "jellyfin.example.test" } },
		},
		message: "Start the address with http:// or https://",
		path: ["containers", "jellyfin", "url"],
	},
	{
		type: "group",
		schema: groupSchema,
		valid: { type: "group", "css-class": "tabs", widgets: [{ type: "rss" }] },
		invalid: { type: "group", cache: "soon" },
		message: "Use a number and a unit: 30s, 5m, 1h or 1d",
		path: ["cache"],
	},
];

describe.each(CASES)("$type schema", (testCase) => {
	it("accepts a valid config", () => {
		const result = testCase.schema.safeParse(testCase.valid);
		expect(result.error?.issues ?? []).toEqual([]);
	});

	it("gives a readable error for invalid input", () => {
		const result = testCase.schema.safeParse(testCase.invalid);
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]).toMatchObject({
			message: testCase.message,
			path: testCase.path,
		});
	});

	it("allows and keeps unknown keys", () => {
		const result = testCase.schema.safeParse({
			...testCase.valid,
			"some-future-option": { nested: true },
		});
		expect(result.success).toBe(true);
		expect(
			result.success &&
				(result.data as Record<string, unknown>)["some-future-option"],
		).toEqual({ nested: true });
	});

	it("is the schema the registry uses", () => {
		expect(schemaFor(testCase.type)).toBe(testCase.schema);
	});
});

describe("registry", () => {
	it("has a form for each of the 10 MVP widgets", () => {
		expect([...FORM_TYPES].sort()).toEqual(
			CASES.map((testCase) => testCase.type).sort(),
		);
		for (const type of FORM_TYPES)
			expect(formFor(type)?.Settings).toBeDefined();
	});

	it("hides the base fields a group ignores", () => {
		expect(formFor("group")?.hiddenBaseFields).toEqual([
			"title",
			"title-url",
			"cache",
			"hide-header",
		]);
	});
});

describe("details", () => {
	it("accepts ${ENV} references in typed fields", () => {
		expect(
			rssSchema.safeParse({ type: "rss", limit: "${RSS_LIMIT}" }).success,
		).toBe(true);
		expect(
			monitorSchema.safeParse({
				type: "monitor",
				sites: [{ url: "https://${NAS_HOST}/status" }],
			}).success,
		).toBe(true);
	});

	it("reads an empty list key (sites:) as fine", () => {
		expect(
			monitorSchema.safeParse({ type: "monitor", sites: null }).success,
		).toBe(true);
	});

	it("checks each alt status code", () => {
		const message = validateField(
			monitorSchema,
			{ type: "monitor", sites: [{ url: "https://a.example.test" }] },
			["sites", 0, "alt-status-codes"],
			[401, "nope"],
		);
		expect(message).toBe("Use status codes like 401, 403");
	});

	it("checks a repository written as a map", () => {
		const result = releasesSchema.safeParse({
			type: "releases",
			repositories: [{ "include-prereleases": "yes" }],
		});
		expect(result.error?.issues.map((issue) => issue.path)).toEqual([
			["repositories", 0, "repository"],
		]);
	});

	it("checks the bookmark group color like Glance does", () => {
		expect(
			bookmarksSchema.safeParse({
				type: "bookmarks",
				groups: [{ color: "hsl(240, 13%, 95%)" }],
			}).success,
		).toBe(true);
		expect(
			bookmarksSchema.safeParse({
				type: "bookmarks",
				groups: [{ color: "red" }],
			}).error?.issues[0]?.message,
		).toBe("Use hue saturation lightness, e.g. 240 13 95");
	});
});
