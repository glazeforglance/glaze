import { WIDGET_SCHEMAS, WIDGET_TYPES } from "@glaze/schemas";
import { describe, expect, it } from "vitest";
import { FORM_TYPES, formFor, schemaFor } from "../../src/forms/registry.ts";
import { validateField } from "../../src/forms/validate.ts";

/** One case per widget: a valid config, an invalid one and its message. */
interface SchemaCase {
	readonly type: string;
	readonly valid: Record<string, unknown>;
	readonly invalid: Record<string, unknown>;
	readonly message: string;
	readonly path: readonly (string | number)[];
}

// Every value is fake.
const CASES: readonly SchemaCase[] = [
	{
		type: "clock",
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
		valid: {
			type: "weather",
			location: "Amsterdam, Netherlands",
			units: "imperial",
		},
		invalid: { type: "weather", units: "metric" },
		message: "Location is required",
		path: ["location"],
	},
	{
		type: "calendar",
		valid: { type: "calendar", "first-day-of-week": "sunday" },
		invalid: { type: "calendar", "first-day-of-week": "funday" },
		message:
			"Use one of: monday, tuesday, wednesday, thursday, friday, saturday, sunday",
		path: ["first-day-of-week"],
	},
	{
		type: "search",
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
			bangs: [{ title: "YouTube", url: "https://a.example.test" }],
		},
		message: "Shortcut is required",
		path: ["bangs", 0, "shortcut"],
	},
	{
		type: "bookmarks",
		valid: {
			type: "bookmarks",
			groups: [
				{
					title: "Media",
					color: "240 13 95",
					links: [
						{
							title: "Sonarr",
							url: "https://sonarr.example.test",
							icon: "si:sonarr",
						},
					],
				},
			],
		},
		invalid: { type: "bookmarks", groups: [{ color: "red", links: [] }] },
		message: "Use hue saturation lightness, e.g. 240 13 95",
		path: ["groups", 0, "color"],
	},
	{
		type: "monitor",
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
		invalid: {
			type: "monitor",
			sites: [
				{ title: "Immich", url: "https://a.example.test", timeout: "soon" },
			],
		},
		message: "Use a number and a unit: 30s, 5m, 1h or 1d",
		path: ["sites", 0, "timeout"],
	},
	{
		type: "rss",
		valid: {
			type: "rss",
			style: "horizontal-cards",
			limit: 10,
			"collapse-after": -1,
			feeds: [{ url: "https://feeds.example.test/rss", title: "News" }],
		},
		invalid: { type: "rss", "collapse-after": -2 },
		message: "Show before “Show more”: use -1 or more",
		path: ["collapse-after"],
	},
	{
		type: "releases",
		valid: {
			type: "releases",
			token: "${GITHUB_TOKEN}",
			repositories: [
				"glanceapp/glance",
				"gitlab:owner/project",
				{ repository: "immich-app/immich", "include-prereleases": true },
			],
		},
		invalid: {
			type: "releases",
			repositories: [{ "include-prereleases": "yes" }],
		},
		message: "Repositories: this form isn't supported",
		path: ["repositories", 0],
	},
	{
		type: "docker-containers",
		valid: {
			type: "docker-containers",
			"running-only": true,
			containers: {
				jellyfin: { name: "Jellyfin", url: "https://jellyfin.example.test" },
			},
		},
		invalid: { type: "docker-containers", "running-only": "yes" },
		message: "Only running containers: use true or false",
		path: ["running-only"],
	},
	{
		type: "group",
		valid: { type: "group", "css-class": "tabs", widgets: [{ type: "rss" }] },
		invalid: { type: "group", cache: "soon" },
		message: "Use a number and a unit: 30s, 5m, 1h or 1d",
		path: ["cache"],
	},
	{
		type: "dns-stats",
		valid: {
			type: "dns-stats",
			service: "pihole-v6",
			url: "http://pihole.example.test",
		},
		invalid: { type: "dns-stats", url: "http://pihole.example.test" },
		message: "Service is required",
		path: ["service"],
	},
	{
		type: "custom-api",
		valid: {
			type: "custom-api",
			url: "https://api.example.test",
			body: { query: "x", limit: 5, tags: ["a"] },
			parameters: { q: "x", id: [1, 2] },
			subrequests: { stats: { url: "https://api.example.test/stats" } },
			options: { colour: "blue" },
			template: '<p>{{ .JSON.String "name" }}</p>',
		},
		invalid: { type: "custom-api", url: "https://api.example.test" },
		message: "Template is required",
		path: ["template"],
	},
	{
		type: "reddit",
		valid: {
			type: "reddit",
			subreddit: "selfhosted",
			proxy: { url: "http://proxy.example.test:8080", timeout: "10s" },
		},
		invalid: { type: "reddit", subreddit: "selfhosted", "sort-by": "best" },
		message: "Use one of: hot, new, top, rising",
		path: ["sort-by"],
	},
];

describe.each(CASES)("$type schema", (testCase) => {
	const schema = schemaFor(testCase.type);

	it("accepts a valid config", () => {
		const result = schema.safeParse(testCase.valid);
		expect(result.error?.issues ?? []).toEqual([]);
	});

	it("gives a readable error for invalid input", () => {
		const result = schema.safeParse(testCase.invalid);
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]).toMatchObject({
			message: testCase.message,
			path: testCase.path,
		});
	});

	it("allows and keeps unknown keys", () => {
		const result = schema.safeParse({
			...testCase.valid,
			"some-future-option": { nested: true },
		});
		expect(result.success).toBe(true);
		expect(
			result.success &&
				(result.data as Record<string, unknown>)["some-future-option"],
		).toEqual({ nested: true });
	});
});

describe("registry", () => {
	it("has a form for every Glance widget type", () => {
		expect(FORM_TYPES).toEqual(WIDGET_TYPES);
		for (const type of Object.keys(WIDGET_SCHEMAS)) {
			expect(formFor(type)?.widget.label, type).toBeTruthy();
		}
		expect(formFor("stocks")?.widget.type).toBe("markets");
		expect(formFor("not-a-widget")).toBeNull();
	});

	it("hides the base fields Glance ignores for containers", () => {
		expect(formFor("group")?.hiddenBaseFields).toEqual([
			"title",
			"title-url",
			"cache",
			"hide-header",
		]);
		expect(formFor("split-column")?.hiddenBaseFields).toContain("title");
	});

	it("accepts every new widget's starting options", () => {
		for (const type of WIDGET_TYPES) {
			const start = { type, ...(WIDGET_SCHEMAS[type]?.newWidget ?? {}) };
			const result = schemaFor(type).safeParse(start);
			expect(result.error?.issues ?? [], type).toEqual(
				// Only required options without a sensible example may be missing.
				type === "extension"
					? [expect.objectContaining({ path: ["url"] })]
					: [],
			);
		}
	});
});

describe("details", () => {
	it("accepts ${ENV} references in typed fields", () => {
		expect(
			schemaFor("rss").safeParse({ type: "rss", limit: "${RSS_LIMIT}" })
				.success,
		).toBe(true);
		expect(
			schemaFor("monitor").safeParse({
				type: "monitor",
				sites: [
					{
						title: "A",
						url: "https://${NAS_HOST}/status",
						timeout: "${TIMEOUT}",
					},
				],
			}).success,
		).toBe(true);
	});

	it("reads an empty list key (sites:) as fine", () => {
		expect(
			schemaFor("monitor").safeParse({ type: "monitor", sites: null }).success,
		).toBe(true);
	});

	it("checks each alt status code", () => {
		const message = validateField(
			schemaFor("monitor"),
			{ type: "monitor", sites: [{ url: "https://a.example.test" }] },
			["sites", 0, "alt-status-codes"],
			[401, "nope"],
		);
		expect(message).toBe("Also OK: enter a whole number");
	});

	it("accepts numbers in text options, as Glance does", () => {
		expect(
			schemaFor("to-do").safeParse({ type: "to-do", id: 123 }).success,
		).toBe(true);
	});
});
