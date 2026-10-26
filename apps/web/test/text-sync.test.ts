import { describe, expect, it } from "vitest";
import { minimalChange, placeIssues } from "../src/lib/codemirror/text-sync.ts";

function apply(text: string, change: ReturnType<typeof minimalChange>) {
	return change
		? text.slice(0, change.from) + change.insert + text.slice(change.to)
		: text;
}

describe("minimalChange", () => {
	it("returns null for equal texts", () => {
		expect(minimalChange("abc", "abc")).toBeNull();
	});

	it("replaces only the part that differs", () => {
		const before = "pages:\n  - name: Home\n    columns: []\n";
		const after = "pages:\n  - name: Start\n    columns: []\n";
		const change = minimalChange(before, after);
		expect(change).toEqual({ from: 17, to: 21, insert: "Start" });
		expect(apply(before, change)).toBe(after);
	});

	it("handles inserts, deletes and repeated characters", () => {
		for (const [before, after] of [
			["aaa", "aaaa"],
			["aaaa", "aa"],
			["", "x"],
			["x", ""],
			["a\nb\n", "a\nc\nb\n"],
		] as const) {
			expect(apply(before, minimalChange(before, after))).toBe(after);
		}
	});
});

describe("placeIssues", () => {
	const text = "pages:\n  - name: Home\n    stlye: x\n";

	it("marks the key of an unknown option", () => {
		const [placed] = placeIssues(
			[
				{
					severity: "warning",
					source: "glaze",
					message: "Typo",
					line: 3,
					fix: {
						kind: "rename-key",
						mapPath: ["pages", 0],
						from: "stlye",
						to: "style",
					},
				},
			],
			text,
		);
		expect(text.slice(placed?.from, placed?.to)).toBe("stlye");
		expect(placed?.severity).toBe("warning");
	});

	it("marks from the column, or the first character, to the end of the line", () => {
		const placed = placeIssues(
			[
				{
					severity: "error",
					source: "yaml",
					message: "Bad",
					line: 2,
					column: 5,
				},
				{ severity: "error", source: "layout", message: "Bad", line: 2 },
			],
			text,
		);
		expect(placed.map(({ from, to }) => text.slice(from, to))).toEqual([
			"name: Home",
			"- name: Home",
		]);
	});

	it("skips issues without a line and clamps lines past the end", () => {
		const placed = placeIssues(
			[
				{ severity: "error", source: "glance", message: "No line" },
				{ severity: "error", source: "glance", message: "Far", line: 99 },
			],
			"a: 1\r\n",
		);
		expect(placed).toHaveLength(1);
		expect(placed[0]?.from).toBeLessThanOrEqual(6);
	});
});
