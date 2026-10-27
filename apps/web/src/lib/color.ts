/*
 * Glance colors are HSL strings ("240 13 14", or "hsl(240, 13%, 14%)").
 * The editor shows them with a swatch and a hex input, so these convert.
 */

/** Hue 0–360, saturation and lightness 0–100. */
export interface Hsl {
	readonly h: number;
	readonly s: number;
	readonly l: number;
}

// The same pattern as Glance's hslColorFieldPattern (config-fields.go).
const HSL_PATTERN =
	/^(?:hsla?\()?\s*([\d.]+)(?:\s|,)+([\d.]+)%?(?:\s|,)+([\d.]+)%?\s*\)?$/;

/**
 * Reads a Glance HSL color.
 * @param text - E.g. `240 13 14` or `hsl(240, 13%, 14%)`.
 * @returns The color, or `null` when Glance wouldn't accept it.
 */
export function parseHsl(text: string): Hsl | null {
	const match = HSL_PATTERN.exec(text.trim());
	if (!match) return null;
	const [h, s, l] = [match[1], match[2], match[3]].map(Number);
	if (h === undefined || s === undefined || l === undefined) return null;
	if (h > 360 || s > 100 || l > 100) return null;
	return { h, s, l };
}

/**
 * Writes a color the way Glance's docs do: `h s l`, rounded.
 * @param color - The color.
 * @returns E.g. `240 13 14`.
 */
export function formatHsl(color: Hsl): string {
	return `${Math.round(color.h)} ${Math.round(color.s)} ${Math.round(color.l)}`;
}

/**
 * Converts HSL to a hex color for a swatch or color input.
 * @param color - The color.
 * @returns E.g. `#1f1f26`.
 */
export function hslToHex({ h, s, l }: Hsl): string {
	const sat = s / 100;
	const light = l / 100;
	const a = sat * Math.min(light, 1 - light);
	const channel = (n: number) => {
		const k = (n + h / 30) % 12;
		const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		return Math.round(value * 255)
			.toString(16)
			.padStart(2, "0");
	};
	return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/**
 * Converts a hex color (`#rgb` or `#rrggbb`) to HSL.
 * @param hex - The hex color.
 * @returns The color, or `null` for anything else.
 */
export function hexToHsl(hex: string): Hsl | null {
	const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
	if (!match?.[1]) return null;
	const digits =
		match[1].length === 3
			? [...match[1]].map((digit) => digit + digit).join("")
			: match[1];
	const [r, g, b] = [0, 2, 4].map(
		(start) => Number.parseInt(digits.slice(start, start + 2), 16) / 255,
	) as [number, number, number];
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	if (d === 0) return { h: 0, s: 0, l: l * 100 };
	const s = d / (1 - Math.abs(2 * l - 1));
	let h: number;
	if (max === r) h = ((g - b) / d) % 6;
	else if (max === g) h = (b - r) / d + 2;
	else h = (r - g) / d + 4;
	h *= 60;
	if (h < 0) h += 360;
	return { h, s: s * 100, l: l * 100 };
}
