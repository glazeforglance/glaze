/*
 * Pure rules for resizable areas (side panels, the code/preview split), so
 * they can be tested without a browser.
 */

/** The allowed range of a size. */
export interface ResizeBounds {
	readonly min: number;
	readonly max: number;
}

/**
 * Keeps a size within its bounds.
 * @param value - Any size.
 * @param bounds - The allowed range.
 * @returns The size, moved into the range.
 */
export function clampSize(value: number, bounds: ResizeBounds): number {
	return Math.min(bounds.max, Math.max(bounds.min, value));
}

/**
 * The size after a key press on a resize handle (WAI-ARIA window splitter):
 * arrows move the handle by `step`, Home and End go to the minimum and maximum.
 * @param key - `KeyboardEvent.key`.
 * @param value - Current size.
 * @param bounds - The allowed range.
 * @param step - How much one arrow press changes the size.
 * @param direction - `1` when moving the handle towards the inline end makes
 *   the area bigger (a handle on the area's end edge), `-1` when it makes it
 *   smaller. `key` is logical: in RTL, pass it through `logicalKey` first.
 * @returns The new size, or `null` for keys the handle doesn't use.
 */
export function sizeAfterKey(
	key: string,
	value: number,
	bounds: ResizeBounds,
	step: number,
	direction: 1 | -1,
): number | null {
	switch (key) {
		case "ArrowRight":
			return clampSize(value + step * direction, bounds);
		case "ArrowLeft":
			return clampSize(value - step * direction, bounds);
		case "Home":
			return bounds.min;
		case "End":
			return bounds.max;
		default:
			return null;
	}
}

/** A side panel's remembered state. */
export interface PanelState {
	readonly width: number;
	readonly collapsed: boolean;
}

/**
 * Reads a stored panel state, falling back to the defaults for anything
 * missing or broken, and clamping a width that is out of bounds (the bounds
 * may have changed since it was stored).
 * @param raw - The stored JSON text, or `null` when nothing is stored.
 * @param defaults - The state to use when nothing usable is stored.
 * @param bounds - The allowed widths.
 * @returns A valid panel state.
 */
export function parsePanelState(
	raw: string | null,
	defaults: PanelState,
	bounds: ResizeBounds,
): PanelState {
	let value: unknown = null;
	try {
		value = raw === null ? null : JSON.parse(raw);
	} catch {
		return defaults;
	}
	if (typeof value !== "object" || value === null) return defaults;
	const width = "width" in value ? value.width : undefined;
	const collapsed = "collapsed" in value ? value.collapsed : undefined;
	return {
		width:
			typeof width === "number" && Number.isFinite(width)
				? clampSize(width, bounds)
				: defaults.width,
		collapsed: typeof collapsed === "boolean" ? collapsed : defaults.collapsed,
	};
}
