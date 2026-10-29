import { i18n } from "../i18n.ts";
/*
 * Widget width as Glaze offers it: full, or 1/n of a split-column. Glance
 * draws a split-column as `max-columns` equal-width columns, so every widget
 * in one split-column has the same width.
 */

/** The widths the editor offers: full, or one of n columns of a split-column. */
export type WidgetWidth = "full" | 2 | 3 | 4;

/** Split-column sizes the resize handle snaps to (½, ⅓, ¼). */
export const SPLIT_STEPS = [2, 3, 4] as const;

/** One of `SPLIT_STEPS`. */
export type SplitStep = (typeof SPLIT_STEPS)[number];

const SYMBOLS: Readonly<Record<number, string>> = { 2: "½", 3: "⅓", 4: "¼" };

/**
 * The fraction a widget takes in a split-column with `columns` columns.
 * @param columns - The split-column's `max-columns`.
 * @returns `½`, `⅓`, `¼`, or `1/n` for other sizes.
 */
export function fractionSymbol(columns: number): string {
	return SYMBOLS[columns] ?? `1/${columns}`;
}

/**
 * The label shown while resizing, e.g. `⅓ · 3 columns`.
 * @param columns - The split-column's `max-columns`.
 * @returns The label.
 */
export function widthLabel(columns: number): string {
	return i18n.t("widths.label", {
		fraction: fractionSymbol(columns),
		count: columns,
	});
}

/**
 * Snaps a dragged width to the nearest of ½, ⅓ and ¼.
 * @param fraction - The dragged width as a share of the split-column's width.
 * @returns The number of columns: 2, 3 or 4.
 */
export function snapColumns(fraction: number): SplitStep {
	let best: SplitStep = 2;
	for (const step of SPLIT_STEPS) {
		if (Math.abs(fraction - 1 / step) < Math.abs(fraction - 1 / best)) {
			best = step;
		}
	}
	return best;
}

/**
 * One keyboard step on the width handle: Left makes the widget narrower
 * (more columns), Right wider, both clamped to ½…¼.
 * @param columns - Current `max-columns`.
 * @param key - `KeyboardEvent.key`.
 * @returns The new number of columns, or `null` for other keys.
 */
export function stepColumns(columns: number, key: string): SplitStep | null {
	const clamp = (value: number): SplitStep =>
		value <= 2 ? 2 : value >= 4 ? 4 : 3;
	if (key === "ArrowLeft") return clamp(columns + 1);
	if (key === "ArrowRight") return clamp(columns - 1);
	if (key === "Home") return 4;
	if (key === "End") return 2;
	return null;
}
