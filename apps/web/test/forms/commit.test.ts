import { describe, expect, it } from "vitest";
import { planCommit } from "../../src/forms/commit.ts";

describe("planCommit", () => {
	it("writes a changed value", () => {
		expect(planCommit({ current: "Old", next: "New" })).toEqual({
			kind: "set",
			value: "New",
		});
	});

	it("writes nothing when the value didn't change", () => {
		expect(planCommit({ current: "Same", next: "Same" })).toEqual({
			kind: "none",
		});
		expect(planCommit({ current: [1, 2], next: [1, 2] })).toEqual({
			kind: "none",
		});
	});

	it("removes the key when a field is cleared, never writing an empty string", () => {
		expect(planCommit({ current: "5m", next: "" })).toEqual({ kind: "remove" });
		expect(planCommit({ current: "5m", next: undefined })).toEqual({
			kind: "remove",
		});
	});

	it("does nothing when an unset field stays empty", () => {
		expect(planCommit({ current: undefined, next: "" })).toEqual({
			kind: "none",
		});
	});

	it("doesn't write Glance's default for a key that isn't there", () => {
		expect(
			planCommit({ current: undefined, next: false, glanceDefault: false }),
		).toEqual({ kind: "none" });
	});

	it("does write the default when the key already exists", () => {
		expect(
			planCommit({ current: true, next: false, glanceDefault: false }),
		).toEqual({ kind: "set", value: false });
	});
});
