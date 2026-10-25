import { describe, expect, it } from "vitest";
import {
	addWidget,
	duplicateWidget,
	getModel,
	moveWidget,
	removeWidget,
	removeWidgetOption,
	serializeConfig,
	setWidgetOption,
} from "../src/index.ts";
import {
	expectLineChanges,
	load,
	FULL_FIXTURE,
	unwrap,
	unwrapErr,
} from "./helpers/line-diff.ts";

const source = FULL_FIXTURE;
const doc = load(source);

const HOME = ["pages", 0] as const;
const CLOCK = [...HOME, "columns", 0, "widgets", 0];
const WEATHER = [...HOME, "columns", 0, "widgets", 1];
const GROUP = [...HOME, "columns", 1, "widgets", 0];
const SPLIT = [...HOME, "columns", 1, "widgets", 1];
const MONITOR = ["pages", 1, "columns", 0, "widgets", 0];

describe("addWidget", () => {
	it("appends a widget to a column", () => {
		const next = serializeConfig(
			unwrap(
				addWidget(doc, ["pages", 1, "columns", 1, "widgets"], {
					type: "calendar",
					"first-day-of-week": "monday",
				}),
			),
		);
		expectLineChanges(source, next, {
			removed: [],
			added: [
				"          - type: calendar",
				"            first-day-of-week: monday",
			],
		});
	});

	it("adds a child to a split-column", () => {
		const next = unwrap(
			addWidget(
				doc,
				[...SPLIT, "widgets"],
				{ type: "reddit", subreddit: "selfhosted" },
				0,
			),
		);
		expect(
			getModel(next)[0]?.columns[1]?.widgets[1]?.children.map(
				(child) => child.type,
			),
		).toEqual(["reddit", "hacker-news", "lobsters"]);
		expectLineChanges(source, serializeConfig(next), {
			removed: [],
			added: [
				"              - type: reddit",
				"                subreddit: selfhosted",
			],
		});
	});

	it("creates head-widgets when the page has none", () => {
		const next = serializeConfig(
			unwrap(addWidget(doc, ["pages", 1, "head-widgets"], { type: "search" })),
		);
		expectLineChanges(source, next, {
			removed: [],
			added: ["    head-widgets:", "      - type: search"],
		});
		expect(next).toContain(
			"                name: ZimaOS\n    head-widgets:\n      - type: search\n\n  - name: Lab\n",
		);
	});

	it("writes ${ENV} placeholders as plain text", () => {
		const next = serializeConfig(
			unwrap(
				addWidget(doc, ["pages", 1, "columns", 1, "widgets"], {
					type: "dns-stats",
					token: "${PIHOLE_TOKEN}",
				}),
			),
		);
		expect(next).toContain(
			"          - type: dns-stats\n            token: ${PIHOLE_TOKEN}\n",
		);
	});

	it("refuses a group inside a group", () => {
		const error = unwrapErr(
			addWidget(doc, [...GROUP, "widgets"], { type: "group" }),
		);
		expect(error.code).toBe("layout-violation");
		expect(error.issues[0]).toMatchObject({
			code: "nested-group",
			path: [...GROUP, "widgets", 3],
		});
	});

	it("rejects a path that is not a widget list", () => {
		expect(
			unwrapErr(addWidget(doc, [...HOME, "columns"], { type: "clock" })).code,
		).toBe("invalid-path");
	});
});

describe("removeWidget", () => {
	it("removes a widget and its blank separator line", () => {
		const next = serializeConfig(unwrap(removeWidget(doc, CLOCK)));
		expectLineChanges(source, next, {
			removed: [
				"          - type: clock",
				"            hour-format: 24h",
				"            timezones:",
				"              - timezone: Europe/Amsterdam",
				"                label: Thuis",
				"",
			],
			added: [],
		});
	});

	it("removes a child of a split-column, with its trailing comment", () => {
		const next = serializeConfig(
			unwrap(removeWidget(doc, [...SPLIT, "widgets", 1])),
		);
		expectLineChanges(source, next, {
			removed: [
				"              - type: lobsters   # second half of the split",
				"                limit: 10",
			],
			added: [],
		});
	});

	it("refuses to remove an anchor that is still used", () => {
		expect(unwrapErr(removeWidget(doc, [...GROUP, "widgets", 0])).code).toBe(
			"invalid-result",
		);
	});
});

describe("moveWidget", () => {
	it("moves a widget within its column", () => {
		const next = serializeConfig(
			unwrap(moveWidget(doc, CLOCK, [...HOME, "columns", 0, "widgets"], 1)),
		);
		expect(next).toContain(
			"              </div>\n\n          - type: clock\n            hour-format: 24h\n",
		);
		expect(next.split("\n").sort()).toEqual(source.split("\n").sort());
	});

	it("moves a widget to another page and re-indents it", () => {
		const next = serializeConfig(
			unwrap(
				moveWidget(
					doc,
					[...SPLIT, "widgets", 1],
					["pages", 2, "columns", 0, "widgets"],
					1,
				),
			),
		);
		expectLineChanges(source, next, {
			removed: [
				"              - type: lobsters   # second half of the split",
				"                limit: 10",
			],
			added: [
				"          - type: lobsters   # second half of the split",
				"            limit: 10",
			],
		});
	});

	it("takes the widget's leading comment along", () => {
		const next = serializeConfig(
			unwrap(moveWidget(doc, GROUP, [...HOME, "columns", 2, "widgets"], 1)),
		);
		expect(next).toContain(
			'radarr.example.test" }\n          # Sonarr upcoming episodes, as tabs.\n          - type: group\n',
		);
		expect(next).toContain(
			"      - size: full\n        widgets:\n          - type: split-column\n",
		);
	});

	it("moves a group's tab into a column on the same page", () => {
		const next = unwrap(
			moveWidget(
				doc,
				[...GROUP, "widgets", 2],
				[...HOME, "columns", 1, "widgets"],
				1,
			),
		);
		const widgets = getModel(next)[0]?.columns[1]?.widgets;
		expect(widgets?.map((widget) => widget.title)).toEqual([
			null,
			"Anime",
			null,
			null,
		]);
		expect(widgets?.[0]?.children).toHaveLength(2);
	});

	it("refuses to move an alias above its anchor", () => {
		expect(
			unwrapErr(
				moveWidget(
					doc,
					[...GROUP, "widgets", 2],
					[...HOME, "columns", 1, "widgets"],
					0,
				),
			).code,
		).toBe("invalid-result");
	});

	it("refuses to put a split-column inside a group", () => {
		expect(
			unwrapErr(moveWidget(doc, SPLIT, [...GROUP, "widgets"], 0)).issues[0]
				?.code,
		).toBe("nested-group");
	});

	it("refuses to move an anchor below its aliases", () => {
		expect(
			unwrapErr(
				moveWidget(doc, [...GROUP, "widgets", 0], [...GROUP, "widgets"], 2),
			).code,
		).toBe("invalid-result");
	});

	it("refuses to move a widget into itself", () => {
		expect(
			unwrapErr(moveWidget(doc, GROUP, [...GROUP, "widgets"], 0)).code,
		).toBe("invalid-move");
	});
});

describe("setWidgetOption", () => {
	it("replaces a scalar in place", () => {
		const next = serializeConfig(
			unwrap(setWidgetOption(doc, WEATHER, "cache", "30m")),
		);
		expectLineChanges(source, next, {
			removed: ["            cache: 15m"],
			added: ["            cache: 30m"],
		});
	});

	it("keeps quotes and trailing comments", () => {
		const anime = serializeConfig(
			unwrap(setWidgetOption(doc, [...GROUP, "widgets", 2], "title", "Anime!")),
		);
		expectLineChanges(source, anime, {
			removed: ['                title: "Anime"'],
			added: ['                title: "Anime!"'],
		});
		const lobsters = serializeConfig(
			unwrap(setWidgetOption(doc, [...SPLIT, "widgets", 1], "type", "reddit")),
		);
		expectLineChanges(source, lobsters, {
			removed: ["              - type: lobsters   # second half of the split"],
			added: ["              - type: reddit   # second half of the split"],
		});
	});

	it("adds a new option after the last one", () => {
		const next = serializeConfig(
			unwrap(setWidgetOption(doc, CLOCK, "title", "Klok")),
		);
		expectLineChanges(source, next, {
			removed: [],
			added: ["            title: Klok"],
		});
		expect(next).toContain(
			"                label: Thuis\n            title: Klok\n\n",
		);
	});

	it("overrides a merged option on an alias-based widget", () => {
		const next = unwrap(
			setWidgetOption(
				doc,
				[...GROUP, "widgets", 1],
				"url",
				"http://sonarr:8989/api/v3/series",
			),
		);
		expectLineChanges(source, serializeConfig(next), {
			removed: [],
			added: ["                url: http://sonarr:8989/api/v3/series"],
		});
	});

	it("writes lists and maps as blocks", () => {
		const next = serializeConfig(
			unwrap(
				setWidgetOption(
					doc,
					["pages", 2, "columns", 0, "widgets", 0],
					"feeds",
					[{ url: "https://a.test/rss" }],
				),
			),
		);
		expectLineChanges(source, next, {
			removed: [
				'            feeds: [ { url: "https://selfh.st/rss/" } ]   # flow style on purpose',
			],
			added: ["            feeds:", "              - url: https://a.test/rss"],
		});
	});

	it("replaces a block scalar template", () => {
		const next = serializeConfig(
			unwrap(
				setWidgetOption(
					doc,
					WEATHER,
					"template",
					'<p>{{ .JSON.String "x" }}</p>\n',
				),
			),
		);
		expect(next).toContain(
			'            template: |\n              <p>{{ .JSON.String "x" }}</p>\n\n      - size: full\n',
		);
	});

	it("refuses widgets that are aliases", () => {
		const aliased = load(
			"a: &w\n  type: clock\npages:\n  - name: A\n    columns:\n      - size: full\n        widgets:\n          - *w\n",
		);
		expect(
			unwrapErr(
				setWidgetOption(
					aliased,
					["pages", 0, "columns", 0, "widgets", 0],
					"title",
					"x",
				),
			).code,
		).toBe("widget-is-alias");
	});
});

describe("removeWidgetOption", () => {
	it("removes a single option line", () => {
		const next = serializeConfig(
			unwrap(removeWidgetOption(doc, MONITOR, "cache")),
		);
		expectLineChanges(source, next, {
			removed: ["            cache: 1m"],
			added: [],
		});
	});

	it("removes a block scalar completely", () => {
		const next = serializeConfig(
			unwrap(removeWidgetOption(doc, WEATHER, "template")),
		);
		expectLineChanges(source, next, {
			removed: [
				"            template: |",
				'              {{ $temp := .JSON.Float "current.temperature_2m" }}',
				'              <div class="weather">',
				'                <span class="size-h1">{{ printf "%.0f" $temp }}°</span>',
				"              </div>",
			],
			added: [],
		});
	});

	it("pulls the next option up when removing the key next to the dash", () => {
		const next = serializeConfig(
			unwrap(removeWidgetOption(doc, MONITOR, "type")),
		);
		expectLineChanges(source, next, {
			removed: ["          - type: monitor", "            cache: 1m"],
			added: ["          - cache: 1m"],
		});
	});

	it("reports options that the widget doesn't set itself", () => {
		expect(
			unwrapErr(removeWidgetOption(doc, [...GROUP, "widgets", 1], "url")).code,
		).toBe("option-not-found");
	});
});

describe("duplicateWidget", () => {
	it("inserts a copy right after the widget, merge keys resolved", () => {
		const next = unwrap(duplicateWidget(doc, [...GROUP, "widgets", 1]));
		const added = [
			"              - type: custom-api",
			"                title: Series",
			"                url: http://sonarr:8989/api/v3/calendar?includeSeries=true",
			"                headers:",
			"                  X-Api-Key: ${SONARR_API_KEY}",
			"                template: |",
			'                  <ul class="list list-gap-10">',
			'                  {{ range .JSON.Array "" }}',
			'                    <li>{{ .String "series.title" }} · S{{ .Int "seasonNumber" }}E{{ .Int "episodeNumber" }}</li>',
			"                  {{ end }}",
			"                  </ul>",
			"                parameters:",
			"                  tags: 1",
		];
		expectLineChanges(source, serializeConfig(next), { removed: [], added });
		const tabs = getModel(next)[0]?.columns[1]?.widgets[0]?.children;
		expect(tabs?.map((tab) => tab.title)).toEqual([
			"Alles",
			"Series",
			"Series",
			"Anime",
		]);
		// The copy doesn't redefine the anchor, so the alias after it still points at the original.
		expect(serializeConfig(next).match(/&sonarr/g)).toHaveLength(1);
	});

	it("keeps the list's blank-line style", () => {
		const next = serializeConfig(unwrap(duplicateWidget(doc, CLOCK)));
		expect(next).toContain(
			"                label: Thuis\n\n          - type: clock\n            hour-format: 24h\n",
		);
	});

	it("gives the copy a new id and keeps the original's", () => {
		const before = getModel(doc)[0]?.columns[0]?.widgets;
		const after = getModel(unwrap(duplicateWidget(doc, CLOCK)))[0]?.columns[0]
			?.widgets;
		expect(after?.[0]?.id).toBe(before?.[0]?.id);
		expect(after?.[2]?.id).toBe(before?.[1]?.id);
		expect(after?.[1]?.id).not.toBe(before?.[0]?.id);
	});

	it("rejects paths that are not widgets", () => {
		expect(unwrapErr(duplicateWidget(doc, [...HOME, "columns", 0])).code).toBe(
			"invalid-path",
		);
		expect(
			unwrapErr(duplicateWidget(doc, [...HOME, "columns", 0, "widgets", 9]))
				.code,
		).toBe("not-found");
	});
});
