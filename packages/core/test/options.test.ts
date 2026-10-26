import { describe, expect, it } from "vitest";
import { findEnvReferences, getWidgetOptions } from "../src/index.ts";
import { FULL_FIXTURE, load, unwrap, unwrapErr } from "./helpers/line-diff.ts";

const doc = load(FULL_FIXTURE);

const HOME = ["pages", 0] as const;
const CLOCK = [...HOME, "columns", 0, "widgets", 0];
const GROUP = [...HOME, "columns", 1, "widgets", 0];
const INCLUDE = [...HOME, "columns", 1, "widgets", 2];
const RELEASES = ["pages", 2, "columns", 1, "widgets", 0];

describe("getWidgetOptions", () => {
	it("reads own options in source order", () => {
		const { options, isAlias } = unwrap(getWidgetOptions(doc, CLOCK));
		expect(isAlias).toBe(false);
		expect([...options.keys()]).toEqual(["type", "hour-format", "timezones"]);
		expect(options.get("timezones")).toEqual({
			key: "timezones",
			value: [{ timezone: "Europe/Amsterdam", label: "Thuis" }],
			source: "own",
			overridesInherited: false,
			env: [],
		});
	});

	it("reports options from a merge key as inherited", () => {
		const { options } = unwrap(getWidgetOptions(doc, [...GROUP, "widgets", 1]));
		expect([...options.keys()]).toEqual([
			"title",
			"parameters",
			"type",
			"url",
			"headers",
			"template",
		]);
		expect(options.get("title")).toMatchObject({
			value: "Series",
			source: "own",
			overridesInherited: true,
		});
		expect(options.get("parameters")).toMatchObject({
			value: { tags: 1 },
			source: "own",
			overridesInherited: false,
		});
		expect(options.get("url")).toMatchObject({
			value: "http://sonarr:8989/api/v3/calendar?includeSeries=true",
			source: "inherited",
		});
	});

	it("reports ${ENV} references without resolving them", () => {
		const { options } = unwrap(getWidgetOptions(doc, RELEASES));
		expect(options.get("token")).toMatchObject({
			value: "${GITHUB_TOKEN}",
			env: [
				{
					kind: "env",
					name: "GITHUB_TOKEN",
					raw: "${GITHUB_TOKEN}",
					whole: true,
					path: [],
				},
			],
		});
	});

	it("reports references nested inside an inherited value", () => {
		const { options } = unwrap(getWidgetOptions(doc, [...GROUP, "widgets", 2]));
		expect(options.get("headers")).toMatchObject({
			source: "inherited",
			value: { "X-Api-Key": "${SONARR_API_KEY}" },
			env: [{ name: "SONARR_API_KEY", path: ["X-Api-Key"], whole: true }],
		});
	});

	it("keeps unknown keys", () => {
		const custom = load(
			"pages:\n  - name: A\n    columns:\n      - size: full\n        widgets:\n          - type: clock\n            not-a-glance-option: 1\n",
		);
		const { options } = unwrap(
			getWidgetOptions(custom, ["pages", 0, "columns", 0, "widgets", 0]),
		);
		expect(options.get("not-a-glance-option")?.value).toBe(1);
	});

	it("reads an alias widget from its anchor and flags it", () => {
		const aliased = load(
			"a: &w\n  type: clock\n  hour-format: 12h\npages:\n  - name: A\n    columns:\n      - size: full\n        widgets:\n          - *w\n",
		);
		const result = unwrap(
			getWidgetOptions(aliased, ["pages", 0, "columns", 0, "widgets", 0]),
		);
		expect(result.isAlias).toBe(true);
		expect(result.options.get("hour-format")?.value).toBe("12h");
	});

	it("refuses include items and non-widget paths", () => {
		expect(unwrapErr(getWidgetOptions(doc, INCLUDE)).code).toBe(
			"unsupported-structure",
		);
		expect(unwrapErr(getWidgetOptions(doc, ["pages", 0])).code).toBe(
			"invalid-path",
		);
		expect(
			unwrapErr(getWidgetOptions(doc, [...HOME, "columns", 0, "widgets", 9]))
				.code,
		).toBe("not-found");
	});
});

describe("findEnvReferences", () => {
	it("finds references inside a longer string", () => {
		expect(
			findEnvReferences("https://${HOST}:8080/${secret:api_path}"),
		).toEqual([
			{ kind: "env", name: "HOST", raw: "${HOST}", whole: false },
			{
				kind: "secret",
				name: "api_path",
				raw: "${secret:api_path}",
				whole: false,
			},
		]);
	});

	it("knows readFileFromEnv", () => {
		expect(findEnvReferences("${readFileFromEnv:TOKEN_FILE}")).toEqual([
			{
				kind: "readFileFromEnv",
				name: "TOKEN_FILE",
				raw: "${readFileFromEnv:TOKEN_FILE}",
				whole: true,
			},
		]);
	});

	it("ignores what Glance leaves alone", () => {
		expect(findEnvReferences("\\${ESCAPED}")).toEqual([]);
		expect(findEnvReferences("${lower_case}")).toEqual([]);
		expect(findEnvReferences("${unknown:NAME}")).toEqual([]);
		expect(findEnvReferences('{{ .JSON.String "x" }}')).toEqual([]);
	});

	it("finds a reference at the start of a template line", () => {
		expect(findEnvReferences("<p>\n${HOST}</p>")).toMatchObject([
			{ name: "HOST" },
		]);
	});
});
