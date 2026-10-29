import type { ValidationIssue } from "@glaze/core";
import { problemText } from "../messages.ts";

/** One replacement that turns one text into another. */
export interface TextChange {
	readonly from: number;
	readonly to: number;
	readonly insert: string;
}

/**
 * Finds the smallest single replacement from `before` to `after`, by skipping
 * the common start and end. Applying only that keeps the cursor and scroll
 * position in the editor when a form edit changes a few lines elsewhere.
 * @param before - The editor's current text.
 * @param after - The new text.
 * @returns The change, or `null` when the texts are equal.
 */
export function minimalChange(
	before: string,
	after: string,
): TextChange | null {
	if (before === after) return null;
	let start = 0;
	const max = Math.min(before.length, after.length);
	while (start < max && before[start] === after[start]) start += 1;
	let endBefore = before.length;
	let endAfter = after.length;
	while (
		endBefore > start &&
		endAfter > start &&
		before[endBefore - 1] === after[endAfter - 1]
	) {
		endBefore -= 1;
		endAfter -= 1;
	}
	return { from: start, to: endBefore, insert: after.slice(start, endAfter) };
}

/** An issue placed in the text, in the shape CodeMirror's lint diagnostics use. */
export interface PlacedIssue {
	readonly from: number;
	readonly to: number;
	readonly severity: "error" | "warning" | "info";
	readonly message: string;
	readonly issue: ValidationIssue;
}

/**
 * Places issues that have a line in the text: from the column (or the line's
 * first non-space character) to the end of that word, or of the line.
 * Issues without a line can't be placed and are left out.
 * @param issues - Issues for exactly this text.
 * @param text - The text the issues were found in.
 * @returns Placed issues, in input order.
 */
export function placeIssues(
	issues: readonly ValidationIssue[],
	text: string,
): PlacedIssue[] {
	const starts = [0];
	for (let i = 0; i < text.length; i++) {
		if (text[i] === "\n") starts.push(i + 1);
	}
	const placed: PlacedIssue[] = [];
	for (const issue of issues) {
		if (issue.line === undefined) continue;
		const index = Math.min(Math.max(issue.line, 1), starts.length) - 1;
		const lineStart = starts[index] ?? 0;
		const lineEnd = (starts[index + 1] ?? text.length + 1) - 1;
		const lineText = text.slice(lineStart, lineEnd).replace(/\r$/, "");
		const indent = lineText.length - lineText.trimStart().length;
		const column =
			issue.column === undefined
				? indent
				: Math.min(issue.column - 1, lineText.length);
		const from = lineStart + column;
		// An unknown option marks just the key; other issues mark the rest of the line.
		const word = /^[^\s:]+/.exec(lineText.slice(column))?.[0] ?? "";
		const to =
			issue.fix !== undefined && word !== ""
				? from + word.length
				: lineStart + lineText.length;
		placed.push({
			from,
			to: Math.max(from, to),
			severity: issue.severity,
			message: problemText(issue),
			issue,
		});
	}
	return placed;
}
