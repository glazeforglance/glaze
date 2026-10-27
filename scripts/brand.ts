// Generates every logo file in the repo from docs/brand/glaze-logo.svg.
//
//   pnpm brand           write all outputs
//   pnpm brand --check   compare with what's committed, exit 1 when stale
//
// Runs on plain Node (built-in type stripping), so only erasable TypeScript here.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "docs/brand/glaze-logo.svg";
const FONTS = [
	"docs/brand/fonts/SpaceGrotesk-Bold.ttf",
	"docs/brand/fonts/SpaceGrotesk-Regular.ttf",
];
// Same as the app's --color-bg, so the icons match the UI.
const BACKGROUND = "#0B0D11";
// Different rasterizer builds (CPU, SIMD paths) can differ by a rounding step
// on anti-aliased edges; a real logo change is far bigger than this.
const PIXEL_TOLERANCE = 2;

interface Output {
	readonly path: string;
	readonly kind: "text" | "png";
	readonly render: (logo: string) => Buffer;
}

const OUTPUTS: readonly Output[] = [
	{
		path: "apps/web/public/favicon.svg",
		kind: "text",
		render: (logo) => Buffer.from(logo, "utf8"),
	},
	{
		// iOS fills transparency with black, so the icon brings its own background.
		path: "apps/web/public/apple-touch-icon.png",
		kind: "png",
		render: (logo) => renderPng(squareIcon(logo, 180, 0.7, BACKGROUND)),
	},
	{
		path: "docs/brand/glaze-logo-512.png",
		kind: "png",
		render: (logo) => renderPng(squareIcon(logo, 512, 1, null)),
	},
	{
		path: "docs/brand/social-preview.png",
		kind: "png",
		render: (logo) => renderPng(socialPreview(logo)),
	},
];

/**
 * Turns the logo into a data URL that a wrapper SVG can place with `<image>`.
 * @param logo - The source SVG text.
 * @returns A `data:image/svg+xml;base64,…` URL.
 */
function logoHref(logo: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(logo, "utf8").toString("base64")}`;
}

/**
 * A square canvas with the logo centered on it.
 * @param logo - The source SVG text.
 * @param size - Canvas width and height in px.
 * @param scale - Logo size as a fraction of the canvas.
 * @param background - Fill color, or `null` for transparent.
 * @returns The wrapper SVG.
 */
function squareIcon(
	logo: string,
	size: number,
	scale: number,
	background: string | null,
): string {
	const logoSize = Math.round(size * scale);
	const offset = (size - logoSize) / 2;
	const fill = background
		? `<rect width="${size}" height="${size}" fill="${background}"/>`
		: "";
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${fill}<image href="${logoHref(logo)}" x="${offset}" y="${offset}" width="${logoSize}" height="${logoSize}"/></svg>`;
}

/**
 * The 1280×640 GitHub social preview: logo, name and tagline, centered.
 * @param logo - The source SVG text.
 * @returns The wrapper SVG.
 */
function socialPreview(logo: string): string {
	const width = 1280;
	const height = 640;
	const logoSize = 220;
	const logoY = 120;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<rect width="${width}" height="${height}" fill="${BACKGROUND}"/>
<image href="${logoHref(logo)}" x="${(width - logoSize) / 2}" y="${logoY}" width="${logoSize}" height="${logoSize}"/>
<text x="${width / 2}" y="${logoY + logoSize + 112}" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="96" letter-spacing="-2" fill="#E6E8EC">Glaze</text>
<text x="${width / 2}" y="${logoY + logoSize + 172}" text-anchor="middle" font-family="Space Grotesk" font-weight="400" font-size="36" fill="#A3ABB8">A visual editor for Glance</text>
</svg>`;
}

/**
 * Renders an SVG with only the bundled fonts, so output is the same on every machine.
 * @param svg - SVG text.
 * @returns The rendered image.
 */
function rasterize(svg: string): ReturnType<Resvg["render"]> {
	return new Resvg(svg, {
		font: {
			fontFiles: FONTS.map((path) => join(ROOT, path)),
			loadSystemFonts: false,
			defaultFontFamily: "Space Grotesk",
		},
	}).render();
}

/**
 * Renders an SVG to PNG bytes.
 * @param svg - SVG text.
 * @returns The PNG file.
 */
function renderPng(svg: string): Buffer {
	return rasterize(svg).asPng();
}

/**
 * Decodes a PNG to RGBA by drawing it 1:1 with resvg, so any PNG encoder's
 * output (palette, RGB, other compression) can be compared by pixels.
 * @param png - PNG bytes.
 * @returns Width, height and RGBA pixels.
 */
function decodePng(png: Buffer): {
	width: number;
	height: number;
	pixels: Buffer;
} {
	// The first IHDR fields sit at fixed offsets: width at 16, height at 20.
	const width = png.readUInt32BE(16);
	const height = png.readUInt32BE(20);
	const image = rasterize(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="data:image/png;base64,${png.toString("base64")}" width="${width}" height="${height}" image-rendering="optimizeSpeed"/></svg>`,
	);
	return { width, height, pixels: image.pixels };
}

/**
 * Whether two PNGs show the same image, within `PIXEL_TOLERANCE` per channel.
 * @param a - PNG bytes.
 * @param b - PNG bytes.
 * @returns `true` when the pixels match.
 */
function samePixels(a: Buffer, b: Buffer): boolean {
	const left = decodePng(a);
	const right = decodePng(b);
	if (left.width !== right.width || left.height !== right.height) return false;
	for (let i = 0; i < left.pixels.length; i++) {
		const diff = Math.abs((left.pixels[i] ?? 0) - (right.pixels[i] ?? 0));
		if (diff > PIXEL_TOLERANCE) return false;
	}
	return true;
}

/**
 * Whether a committed file matches the fresh output. Text ignores line
 * endings (Git may check files out with CRLF on Windows).
 * @param output - The output definition.
 * @param fresh - What the generator produced.
 * @param committed - The file on disk, or `null` when it's missing.
 * @returns `true` when up to date.
 */
function isUpToDate(
	output: Output,
	fresh: Buffer,
	committed: Buffer | null,
): boolean {
	if (committed === null) return false;
	if (output.kind === "png") return samePixels(fresh, committed);
	const normalize = (bytes: Buffer) =>
		bytes.toString("utf8").replace(/\r\n/g, "\n");
	return normalize(fresh) === normalize(committed);
}

/**
 * Reads a repo file, or `null` when it doesn't exist.
 * @param path - Path relative to the repo root.
 * @returns The bytes, or `null`.
 */
function readOptional(path: string): Buffer | null {
	try {
		return readFileSync(join(ROOT, path));
	} catch {
		return null;
	}
}

/**
 * Entry point: writes every output, or in `--check` mode lists the stale ones.
 * @param args - Command-line arguments.
 * @returns The process exit code.
 */
function main(args: readonly string[]): number {
	const check = args.includes("--check");
	const logo = readFileSync(join(ROOT, SOURCE), "utf8");
	const stale: string[] = [];

	for (const output of OUTPUTS) {
		const fresh = output.render(logo);
		if (check) {
			if (!isUpToDate(output, fresh, readOptional(output.path))) {
				stale.push(output.path);
			}
		} else {
			writeFileSync(join(ROOT, output.path), fresh);
			console.log(`wrote ${output.path}`);
		}
	}

	if (stale.length > 0) {
		console.error(`Brand assets are out of date with ${SOURCE}:`);
		for (const path of stale) console.error(`  ${path}`);
		console.error("Run `pnpm brand` and commit the results.");
		return 1;
	}
	if (check) console.log(`All ${OUTPUTS.length} brand assets match ${SOURCE}.`);
	return 0;
}

process.exitCode = main(process.argv.slice(2));
