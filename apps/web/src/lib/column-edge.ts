import { type ColumnSize, columnSizeProblem } from "@glaze/core";

/** What dragging the edge between two page columns does. */
export type ColumnEdgeResult =
	| {
			readonly kind: "change";
			readonly index: number;
			readonly size: ColumnSize;
	  }
	| { readonly kind: "blocked"; readonly reason: string };

/**
 * Works out what dragging the edge between column `edge` and `edge + 1`
 * does. Glance columns are `small` (fixed width) or `full` (shares the rest),
 * so dragging right makes the left column `full` or the right one `small`,
 * and dragging left does the opposite. The first change Glance's rules allow
 * (1 or 2 full columns) wins; otherwise the reason is returned.
 * @param sizes - The page's column sizes, in order.
 * @param edge - Index of the column left of the edge.
 * @param direction - `1` for a drag to the right, `-1` to the left.
 * @returns The size change, or why there is none.
 */
export function columnEdgeChange(
	sizes: readonly (string | null)[],
	edge: number,
	direction: 1 | -1,
): ColumnEdgeResult {
	const grow: [number, ColumnSize][] =
		direction === 1
			? [
					[edge, "full"],
					[edge + 1, "small"],
				]
			: [
					[edge, "small"],
					[edge + 1, "full"],
				];
	let reason: string | null = null;
	for (const [index, size] of grow) {
		if (index < 0 || index >= sizes.length || sizes[index] === size) continue;
		const problem = columnSizeProblem(sizes, index, size);
		if (problem === null) return { kind: "change", index, size };
		reason ??= problem;
	}
	return {
		kind: "blocked",
		reason:
			reason ??
			(direction === 1
				? `Column ${edge + 1} is already full and column ${edge + 2} already small.`
				: `Column ${edge + 1} is already small and column ${edge + 2} already full.`),
	};
}
