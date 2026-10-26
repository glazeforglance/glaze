import { describe, expect, it } from "vitest";
import {
	type EditError,
	type GlazeDocument,
	getWidgetOptions,
	type Result,
	insertWidgetListItem,
	moveWidgetListItem,
	removeWidgetValue,
	serializeConfig,
	setWidgetValue,
} from "../src/index.ts";
import {
	expectLineChanges,
	FULL_FIXTURE,
	load,
	unwrap,
	unwrapErr,
} from "./helpers/line-diff.ts";

const SITES = `            sites:
              # Photos
              - title: Immich
                url: https://immich.example.test
                check-url: http://immich:2283/api/server/ping

              # Comics, behind the tunnel
              - title: Komga
                url: https://komga.example.test   # public URL
                icon: si:komga

              - <<: *site
                title: Jellyfin
                url: "https://jellyfin.example.test"
`;

// Every URL and key in this fixture is fake.
const source = `# Fixture for nested widget edits.
defaults:
  site: &site
    allow-insecure: true
    same-tab: true
  shared-sites: &shared
    - title: NAS
      url: https://nas.example.test

pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: monitor
            title: Services   # shown above the list
            style: compact
${SITES}
          - type: monitor
            sites: *shared

          - type: releases
            token: \${GITHUB_TOKEN}
            repositories:
              - glanceapp/glance   # the dashboard
              - immich-app/immich

          - type: bookmarks
            groups:
              - title: Media
                links:
                  - { title: Sonarr, url: "https://sonarr.example.test" }
                  - title: Radarr
                    url: https://radarr.example.test
`;
const doc = load(source);

const WIDGETS = ["pages", 0, "columns", 0, "widgets"] as const;
const MONITOR = [...WIDGETS, 0];
const SHARED = [...WIDGETS, 1];
const RELEASES = [...WIDGETS, 2];
const BOOKMARKS = [...WIDGETS, 3];

/** The serialized document of a successful edit. */
function text(result: Result<GlazeDocument, EditError>): string {
	return serializeConfig(unwrap(result));
}

describe("fixture", () => {
	it("round-trips unchanged", () => {
		expect(serializeConfig(doc)).toBe(source);
	});
});

describe("setWidgetValue", () => {
	it("replaces a nested scalar in place, keeping its trailing comment", () => {
		const next = text(
			setWidgetValue(
				doc,
				MONITOR,
				["sites", 1, "url"],
				"https://komga.lan.test",
			),
		);
		expectLineChanges(source, next, {
			removed: [
				"                url: https://komga.example.test   # public URL",
			],
			added: ["                url: https://komga.lan.test   # public URL"],
		});
	});

	it("keeps the quote style", () => {
		const next = text(
			setWidgetValue(doc, MONITOR, ["sites", 2, "url"], "https://jf.lan.test"),
		);
		expectLineChanges(source, next, {
			removed: ['                url: "https://jellyfin.example.test"'],
			added: ['                url: "https://jf.lan.test"'],
		});
	});

	it("adds a missing key at the end of its map", () => {
		const next = text(
			setWidgetValue(doc, MONITOR, ["sites", 0, "icon"], "si:immich"),
		);
		expectLineChanges(source, next, {
			removed: [],
			added: ["                icon: si:immich"],
		});
		expect(next).toContain(
			"check-url: http://immich:2283/api/server/ping\n                icon: si:immich\n\n",
		);
	});

	it("replaces a scalar list item in place", () => {
		const next = text(
			setWidgetValue(
				doc,
				RELEASES,
				["repositories", 0],
				"glanceapp/glance-fork",
			),
		);
		expectLineChanges(source, next, {
			removed: ["              - glanceapp/glance   # the dashboard"],
			added: ["              - glanceapp/glance-fork   # the dashboard"],
		});
	});

	it("replaces a map list item, keeping the comment above it", () => {
		const next = text(
			setWidgetValue(doc, MONITOR, ["sites", 1], {
				title: "Kavita",
				url: "https://kavita.example.test",
			}),
		);
		expectLineChanges(source, next, {
			removed: [
				"              - title: Komga",
				"                url: https://komga.example.test   # public URL",
				"                icon: si:komga",
			],
			added: [
				"              - title: Kavita",
				"                url: https://kavita.example.test",
			],
		});
		expect(next).toContain(
			"              # Comics, behind the tunnel\n              - title: Kavita\n",
		);
	});

	it("edits a scalar inside a flow map", () => {
		const next = text(
			setWidgetValue(
				doc,
				BOOKMARKS,
				["groups", 0, "links", 0, "url"],
				"https://sonarr.lan.test",
			),
		);
		expectLineChanges(source, next, {
			removed: [
				'                  - { title: Sonarr, url: "https://sonarr.example.test" }',
			],
			added: [
				'                  - { title: Sonarr, url: "https://sonarr.lan.test" }',
			],
		});
	});

	it("quotes a value that would break a flow map", () => {
		const next = unwrap(
			setWidgetValue(
				doc,
				BOOKMARKS,
				["groups", 0, "links", 0, "title"],
				"TV, shows",
			),
		);
		expect(serializeConfig(next)).toContain(
			'- { title: "TV, shows", url: "https://sonarr.example.test" }',
		);
		const groups = unwrap(getWidgetOptions(next, BOOKMARKS)).options.get(
			"groups",
		);
		expect(groups?.value).toEqual([
			{
				title: "Media",
				links: [
					{ title: "TV, shows", url: "https://sonarr.example.test" },
					{ title: "Radarr", url: "https://radarr.example.test" },
				],
			},
		]);
	});

	it("writes ${ENV} references as plain text", () => {
		const next = text(
			setWidgetValue(doc, MONITOR, ["sites", 0, "url"], "${IMMICH_URL}"),
		);
		expectLineChanges(source, next, {
			removed: ["                url: https://immich.example.test"],
			added: ["                url: ${IMMICH_URL}"],
		});
	});
});

describe("removeWidgetValue", () => {
	it("removes a nested key", () => {
		const next = text(removeWidgetValue(doc, MONITOR, ["sites", 1, "icon"]));
		expectLineChanges(source, next, {
			removed: ["                icon: si:komga"],
			added: [],
		});
	});

	it("removes a list item with its comment, keeping the others' comments", () => {
		const next = text(removeWidgetValue(doc, MONITOR, ["sites", 1]));
		expectLineChanges(source, next, {
			removed: [
				"              # Comics, behind the tunnel",
				"              - title: Komga",
				"                url: https://komga.example.test   # public URL",
				"                icon: si:komga",
				"",
			],
			added: [],
		});
		expect(next).toContain(
			"              # Photos\n              - title: Immich\n",
		);
	});

	it("removes the last list item and the blank line before it", () => {
		const next = text(removeWidgetValue(doc, MONITOR, ["sites", 2]));
		// Blank lines are identical, so the diff reports the separator after the block.
		expectLineChanges(source, next, {
			removed: [
				"              - <<: *site",
				"                title: Jellyfin",
				'                url: "https://jellyfin.example.test"',
				"",
			],
			added: [],
		});
		expect(next).toContain(
			"                icon: si:komga\n\n          - type: monitor\n            sites: *shared\n",
		);
	});

	it("refuses a key that isn't set", () => {
		expect(
			unwrapErr(removeWidgetValue(doc, MONITOR, ["sites", 0, "icon"])).code,
		).toBe("option-not-found");
	});
});

describe("insertWidgetListItem", () => {
	const grafana = { title: "Grafana", url: "https://grafana.example.test" };

	it("appends an item, keeping the blank-line spacing", () => {
		const next = text(insertWidgetListItem(doc, MONITOR, ["sites"], grafana));
		expectLineChanges(source, next, {
			removed: [],
			added: [
				"              - title: Grafana",
				"                url: https://grafana.example.test",
				"",
			],
		});
		expect(next).toContain(
			'                url: "https://jellyfin.example.test"\n\n              - title: Grafana\n                url: https://grafana.example.test\n\n          - type: monitor\n',
		);
	});

	it("inserts above an item's comment, so the comment stays with its item", () => {
		const next = text(
			insertWidgetListItem(doc, MONITOR, ["sites"], grafana, 1),
		);
		expect(next).toContain(
			"              - title: Grafana\n                url: https://grafana.example.test\n\n              # Comics, behind the tunnel\n              - title: Komga\n",
		);
		expectLineChanges(source, next, {
			removed: [],
			added: [
				"              - title: Grafana",
				"                url: https://grafana.example.test",
				"",
			],
		});
	});

	it("follows the style of a list without blank lines", () => {
		const next = text(
			insertWidgetListItem(doc, BOOKMARKS, ["groups", 0, "links"], {
				title: "Lidarr",
				url: "https://lidarr.example.test",
			}),
		);
		expectLineChanges(source, next, {
			removed: [],
			added: [
				"                  - title: Lidarr",
				"                    url: https://lidarr.example.test",
			],
		});
	});

	it("creates a missing list", () => {
		const next = text(
			insertWidgetListItem(doc, MONITOR, ["sites", 0, "alt-status-codes"], 401),
		);
		expectLineChanges(source, next, {
			removed: [],
			added: ["                alt-status-codes:", "                  - 401"],
		});
	});

	it("refuses flow-style lists", () => {
		const fullDoc = load(FULL_FIXTURE);
		expect(
			unwrapErr(
				insertWidgetListItem(
					fullDoc,
					["pages", 2, "columns", 0, "widgets", 0],
					["feeds"],
					{
						url: "https://a.test/rss",
					},
				),
			).code,
		).toBe("unsupported-structure");
	});
});

describe("moveWidgetListItem", () => {
	it("moves an item together with its comment", () => {
		const next = text(moveWidgetListItem(doc, MONITOR, ["sites"], 0, 2));
		const moved = `            sites:
              # Comics, behind the tunnel
              - title: Komga
                url: https://komga.example.test   # public URL
                icon: si:komga

              - <<: *site
                title: Jellyfin
                url: "https://jellyfin.example.test"

              # Photos
              - title: Immich
                url: https://immich.example.test
                check-url: http://immich:2283/api/server/ping
`;
		expect(next).toBe(source.replace(SITES, moved));
	});

	it("moves a scalar item with its trailing comment", () => {
		const next = text(
			moveWidgetListItem(doc, RELEASES, ["repositories"], 0, 1),
		);
		expect(next).toContain(
			"            repositories:\n              - immich-app/immich\n              - glanceapp/glance   # the dashboard\n",
		);
	});

	it("leaves the document alone when the index doesn't change", () => {
		expect(unwrap(moveWidgetListItem(doc, MONITOR, ["sites"], 1, 1))).toBe(doc);
	});

	it("refuses indexes outside the list", () => {
		expect(
			unwrapErr(moveWidgetListItem(doc, MONITOR, ["sites"], 0, 3)).code,
		).toBe("index-out-of-range");
		expect(
			unwrapErr(moveWidgetListItem(doc, MONITOR, ["sites"], 5, 0)).code,
		).toBe("index-out-of-range");
	});
});

describe("anchors and aliases", () => {
	it("refuses to edit a value that only comes from a merge key", () => {
		expect(
			unwrapErr(
				setWidgetValue(doc, MONITOR, ["sites", 2, "allow-insecure"], false),
			).code,
		).toBe("option-inherited");
		const fullDoc = load(FULL_FIXTURE);
		const series = ["pages", 0, "columns", 1, "widgets", 0, "widgets", 1];
		expect(
			unwrapErr(setWidgetValue(fullDoc, series, ["headers", "X-Api-Key"], "x"))
				.code,
		).toBe("option-inherited");
		expect(
			unwrapErr(removeWidgetValue(fullDoc, series, ["headers"])).code,
		).toBe("option-inherited");
	});

	it("refuses to edit through an alias", () => {
		expect(
			unwrapErr(
				setWidgetValue(doc, SHARED, ["sites", 0, "url"], "https://x.test"),
			).code,
		).toBe("option-is-alias");
		expect(
			unwrapErr(
				insertWidgetListItem(doc, SHARED, ["sites"], { url: "https://x.test" }),
			).code,
		).toBe("option-is-alias");
	});

	it("edits the anchored item itself, which every alias then sees", () => {
		const fullDoc = load(FULL_FIXTURE);
		const all = ["pages", 0, "columns", 1, "widgets", 0, "widgets", 0];
		const next = unwrap(
			setWidgetValue(fullDoc, all, ["headers", "X-Api-Key"], "${SONARR_KEY}"),
		);
		expectLineChanges(FULL_FIXTURE, serializeConfig(next), {
			removed: ["                  X-Api-Key: ${SONARR_API_KEY}"],
			added: ["                  X-Api-Key: ${SONARR_KEY}"],
		});
		const series = unwrap(
			getWidgetOptions(next, [
				"pages",
				0,
				"columns",
				1,
				"widgets",
				0,
				"widgets",
				1,
			]),
		);
		expect(series.options.get("headers")?.value).toEqual({
			"X-Api-Key": "${SONARR_KEY}",
		});
	});
});

describe("refused paths", () => {
	it("doesn't edit child widgets of a group", () => {
		const fullDoc = load(FULL_FIXTURE);
		const group = ["pages", 0, "columns", 1, "widgets", 0];
		expect(
			unwrapErr(setWidgetValue(fullDoc, group, ["widgets", 0, "title"], "x"))
				.code,
		).toBe("invalid-path");
	});

	it("refuses an empty sub-path, wrong segment types and missing parents", () => {
		expect(unwrapErr(setWidgetValue(doc, MONITOR, [], "x")).code).toBe(
			"invalid-path",
		);
		expect(
			unwrapErr(setWidgetValue(doc, MONITOR, ["sites", "a"], "x")).code,
		).toBe("invalid-path");
		expect(
			unwrapErr(setWidgetValue(doc, MONITOR, ["sites", 7, "url"], "x")).code,
		).toBe("index-out-of-range");
		// A missing list can't get an item at an index.
		expect(
			unwrapErr(setWidgetValue(doc, MONITOR, ["nothing", 0, "url"], "x")).code,
		).toBe("not-found");
		expect(
			unwrapErr(insertWidgetListItem(doc, MONITOR, ["nothing", "here"], "x"))
				.code,
		).toBe("not-found");
		expect(
			unwrapErr(removeWidgetValue(doc, MONITOR, ["nothing", "here"])).code,
		).toBe("option-not-found");
	});

	it("creates missing maps on the way to a nested key", () => {
		const next = text(
			setWidgetValue(
				doc,
				MONITOR,
				["sites", 0, "basic-auth", "username"],
				"admin",
			),
		);
		expectLineChanges(source, next, {
			removed: [],
			added: [
				"                basic-auth:",
				"                  username: admin",
			],
		});
		const options = unwrap(getWidgetOptions(load(next), MONITOR)).options;
		const sites = options.get("sites")?.value;
		expect(Array.isArray(sites) && sites[0]).toMatchObject({
			"basic-auth": { username: "admin" },
		});
	});

	it("adds to a map created earlier instead of nesting again", () => {
		const first = unwrap(
			setWidgetValue(
				doc,
				MONITOR,
				["sites", 0, "basic-auth", "username"],
				"admin",
			),
		);
		const next = text(
			setWidgetValue(
				first,
				MONITOR,
				["sites", 0, "basic-auth", "password"],
				"${IMMICH_PASSWORD}",
			),
		);
		expect(next).toContain(
			"                basic-auth:\n                  username: admin\n                  password: ${IMMICH_PASSWORD}\n",
		);
	});

	it("refuses alias widgets", () => {
		const aliased = load(
			"a: &w\n  type: monitor\n  sites:\n    - url: https://a.test\npages:\n  - name: A\n    columns:\n      - size: full\n        widgets:\n          - *w\n",
		);
		expect(
			unwrapErr(
				setWidgetValue(
					aliased,
					["pages", 0, "columns", 0, "widgets", 0],
					["sites", 0, "url"],
					"https://b.test",
				),
			).code,
		).toBe("widget-is-alias");
	});
});
