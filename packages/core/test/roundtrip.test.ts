import { describe, expect, it } from "vitest";
import { addWidget, parseConfig, serializeConfig } from "../src/index.ts";
import { load, FULL_FIXTURE, unwrap, unwrapErr } from "./helpers/line-diff.ts";

const fixture = FULL_FIXTURE;

describe("round-trip", () => {
	it("returns the fixture byte for byte", () => {
		expect(serializeConfig(load(fixture))).toBe(fixture);
	});

	it("keeps Windows line endings", () => {
		const crlf = fixture.replace(/\r?\n/g, "\r\n");
		expect(serializeConfig(load(crlf))).toBe(crlf);
	});

	it("uses the file's own line endings for edits", () => {
		const crlf = fixture.replace(/\r?\n/g, "\r\n");
		const next = serializeConfig(
			unwrap(
				addWidget(load(crlf), ["pages", 1, "columns", 1, "widgets"], {
					type: "calendar",
					"first-day": 1,
				}),
			),
		);
		expect(next).toContain(
			"          - type: calendar\r\n            first-day: 1\r\n",
		);
		expect(next.replace(/\r\n/g, "")).not.toContain("\n");
	});

	it("keeps a file without a trailing newline", () => {
		const text =
			"pages:\n  - name: Home   # c\n    columns:\n      - size: full";
		expect(serializeConfig(load(text))).toBe(text);
	});
});

describe("parseConfig errors", () => {
	it("reports YAML syntax errors with a line number", () => {
		const error = unwrapErr(parseConfig("pages:\n  - name: Home\n   bad: [\n"));
		expect(error.code).toBe("yaml-syntax");
		expect(error.line).toBeGreaterThan(0);
	});

	it("reports aliases without an anchor", () => {
		const error = unwrapErr(parseConfig("pages:\n  - *missing\n"));
		expect(error).toMatchObject({ code: "unresolved-alias", line: 2 });
	});
});
