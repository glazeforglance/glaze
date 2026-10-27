import { parseConfig } from "@glaze/core";
import { describe, expect, it } from "vitest";
import { findMissingOptions } from "../src/required-options.ts";
import { validateDraft } from "../src/validate.ts";

// Fake values only.
const CONFIG = `pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: weather
          - type: weather
            location: \${HOME_CITY}
          - type: search
            bangs:
              - title: YouTube
                url: https://yt.example.test/?q={QUERY}
          - type: bookmarks
            groups:
              - links:
                  - title: Ok
                    url: https://ok.example.test
                  - title: No URL
          - type: releases
            repositories:
              - glanceapp/glance
              - include-prereleases: true
          - type: group
            widgets:
              - type: custom-api
                url: https://api.example.test
          - &base
            type: reddit
          - *base
`;

function load(text: string) {
	const parsed = parseConfig(text);
	if (!parsed.ok) throw new Error(parsed.error.message);
	return parsed.value;
}

describe("findMissingOptions", () => {
	const missing = findMissingOptions(load(CONFIG));
	const messages = missing.map((item) => item.message);

	it("says in plain words what a widget needs", () => {
		expect(messages).toContain("Weather needs a location");
		expect(messages).toContain("Custom API needs a template");
		expect(messages).toContain("Reddit needs a subreddit");
	});

	it("counts a ${VAR} as set", () => {
		expect(
			messages.filter((message) => message === "Weather needs a location"),
		).toHaveLength(1);
	});

	it("finds missing options in list items, also nested ones and union objects", () => {
		expect(messages).toContain("Search needs a shortcut for bang 1");
		expect(messages).toContain("Bookmarks needs a URL for link 2 in group 1");
		expect(messages).toContain("Releases needs a repository for repository 2");
		expect(
			missing.find((item) => item.message.endsWith("bang 1"))?.path,
		).toEqual(["pages", 0, "columns", 0, "widgets", 2, "bangs", 0]);
	});

	it("skips aliases, so an anchored widget is reported once", () => {
		expect(
			messages.filter((message) => message === "Reddit needs a subreddit"),
		).toHaveLength(1);
	});
});

describe("validateDraft", () => {
	it("blocks publishing with the plain message, on the widget's line", async () => {
		const issues = await validateDraft(CONFIG, {
			configPath: "glance.yml",
			glance: null,
		});
		expect(issues).toContainEqual(
			expect.objectContaining({
				severity: "error",
				source: "glaze",
				message: "Weather needs a location",
				line: 6,
			}),
		);
	});

	it("knows every widget type's options, not only the ones with a hand-made form", async () => {
		const text = `pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: videos
            channels: [UCxxxx]
            colapse-after: 3
`;
		const issues = await validateDraft(text, {
			configPath: "glance.yml",
			glance: null,
		});
		expect(issues).toContainEqual(
			expect.objectContaining({
				severity: "warning",
				message:
					'Unknown option "colapse-after". Did you mean "collapse-after"?',
			}),
		);
	});
});
