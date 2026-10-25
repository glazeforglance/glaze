import { expect } from "vitest";
import {
	type GlazeDocument,
	parseConfig,
	type Result,
} from "../../src/index.ts";

/** Lines only in `before` and lines only in `after`, in order. */
export interface LineDiff {
	readonly removed: string[];
	readonly added: string[];
}

/**
 * Computes a line diff with a longest-common-subsequence table.
 * @param before - Original text.
 * @param after - Changed text.
 * @returns Removed and added lines (without line endings).
 */
export function diffLines(before: string, after: string): LineDiff {
	const a = before.split(/\r?\n/);
	const b = after.split(/\r?\n/);
	const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
		new Array<number>(b.length + 1).fill(0),
	);
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			const row = lcs[i] as number[];
			row[j] =
				a[i] === b[j]
					? (lcs[i + 1]?.[j + 1] ?? 0) + 1
					: Math.max(lcs[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
		}
	}
	const removed: string[] = [];
	const added: string[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length || j < b.length) {
		if (i < a.length && j < b.length && a[i] === b[j]) {
			i++;
			j++;
		} else if (
			j < b.length &&
			(i >= a.length || (lcs[i]?.[j + 1] ?? 0) >= (lcs[i + 1]?.[j] ?? 0))
		) {
			added.push(b[j] as string);
			j++;
		} else {
			removed.push(a[i] as string);
			i++;
		}
	}
	return { removed, added };
}

/**
 * Collects every comment in YAML text (from `#` to the end of the line).
 * Good enough for the fixtures, which have no `#` inside strings.
 */
export function commentsOf(text: string): string[] {
	return [...text.matchAll(/(?:^|\s)(#.*)$/gm)].map((match) =>
		(match[1] as string).trimEnd(),
	);
}

/**
 * Asserts that going from `before` to `after` changed exactly the given lines,
 * and that every comment outside the removed lines is still there.
 */
export function expectLineChanges(
	before: string,
	after: string,
	expected: LineDiff,
): void {
	expect(diffLines(before, after)).toEqual(expected);
	const removedComments = commentsOf(expected.removed.join("\n"));
	const kept = commentsOf(before).filter((comment) => {
		const at = removedComments.indexOf(comment);
		if (at === -1) return true;
		removedComments.splice(at, 1);
		return false;
	});
	const afterComments = commentsOf(after);
	for (const comment of kept) expect(afterComments).toContain(comment);
}

/** The full fixture, loaded by Vite as an exact string (`?raw`), so no Node APIs are needed. */
export { default as FULL_FIXTURE } from "../fixtures/glance.full.yml?raw";

/** Parses YAML text and fails the test when it isn't valid. */
export function load(text: string): GlazeDocument {
	return unwrap(parseConfig(text));
}

/** Returns the value of a successful `Result`, or fails the test with its error. */
export function unwrap<T, E>(result: Result<T, E>): T {
	if (!result.ok)
		throw new Error(`Expected ok, got ${JSON.stringify(result.error)}`);
	return result.value;
}

/** Returns the error of a failed `Result`, or fails the test. */
export function unwrapErr<T, E>(result: Result<T, E>): E {
	if (result.ok) throw new Error("Expected an error, got ok");
	return result.error;
}
