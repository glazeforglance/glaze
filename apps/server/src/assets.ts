import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { err, ok, parseConfig, type Result } from "@glaze/core";
import { hashText, type StoreError, writeFileSafely } from "./config-store.ts";

/** Asset files are text you edit by hand; anything bigger is refused. */
export const MAX_ASSET_BYTES = 1024 * 1024;

const ASSET_URL_PREFIX = "/assets/";
// One or more path segments of safe characters, ending in .css, .js or .mjs.
const SAFE_NAME =
	/^[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;
const EDITABLE_EXTENSIONS = /\.(?:css|m?js)$/;

/** An asset file the config references, as the API lists it. */
export interface AssetEntry {
	/** Path below `server.assets-path`, e.g. `custom.css` or `js/design.js`. */
	readonly name: string;
	readonly language: "css" | "javascript";
}

/** An asset file's contents, like the config: `version` is `null` while it doesn't exist. */
export interface AssetFile {
	readonly name: string;
	readonly text: string;
	readonly version: string | null;
}

/** Why an asset file can't be read or written. */
export interface AssetError {
	readonly code:
		| "invalid-name"
		| "not-referenced"
		| "no-assets-path"
		| "outside-config-folder"
		| "not-text"
		| "too-large"
		| StoreError["code"];
	/** E.g. `{ reason }` for `io-error`; the web app builds the sentence from the code. */
	readonly params?: Readonly<Record<string, string | number>>;
	readonly message: string;
}

function stringAt(text: string, path: readonly string[]): string | null {
	const parsed = parseConfig(text);
	if (!parsed.ok) return null;
	const value: unknown = parsed.value.yaml.getIn(path);
	return typeof value === "string" ? value : null;
}

function assetName(url: string): string | null {
	if (!url.startsWith(ASSET_URL_PREFIX)) return null;
	// Drop `?v=2` or `#x`: Glance serves the file without them.
	const name = url.slice(ASSET_URL_PREFIX.length).replace(/[?#].*$/, "");
	return isSafeName(name) ? name : null;
}

/**
 * Tells whether an asset name is a plain relative path with an editable
 * extension: no `..`, no absolute path, no backslashes, no encoded characters.
 * @param name - The name from the config or the URL.
 * @returns True when it is safe to join to the assets folder.
 */
export function isSafeName(name: string): boolean {
	return (
		SAFE_NAME.test(name) &&
		EDITABLE_EXTENSIONS.test(name) &&
		!name.split("/").some((part) => part === "." || part === "..")
	);
}

/**
 * Lists the asset files a config references below `server.assets-path`:
 * `theme.custom-css-file`, plus `<link href="/assets/…">` and
 * `<script src="/assets/…">` in `document.head`.
 * @param text - The config text.
 * @returns Unique entries, in the order above.
 */
export function findReferencedAssets(text: string): AssetEntry[] {
	const names: string[] = [];
	const css = stringAt(text, ["theme", "custom-css-file"]);
	if (css !== null) names.push(css);
	const head = stringAt(text, ["document", "head"]) ?? "";
	for (const match of head.matchAll(
		/<(?:link|script)\b[^>]*?\b(?:href|src)\s*=\s*["']([^"']+)["']/gi,
	)) {
		if (match[1]) names.push(match[1]);
	}
	const entries: AssetEntry[] = [];
	for (const url of names) {
		const name = assetName(url);
		if (name === null || entries.some((entry) => entry.name === name)) continue;
		entries.push({
			name,
			language: name.endsWith(".css") ? "css" : "javascript",
		});
	}
	return entries;
}

function isInside(folder: string, path: string): boolean {
	const rel = relative(folder, path);
	return (
		rel === "" ||
		(!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))
	);
}

/**
 * Resolves an asset name to a file path. The name must be a safe relative
 * path that the config references, and the file must lie inside the assets
 * folder, so the API can never reach other files.
 *
 * Which folder that is:
 * - with `assetsDir` (`GLAZE_ASSETS_PATH`): that folder. `server.assets-path`
 *   is a path inside the *Glance* container (e.g. `/assets`), which means
 *   nothing inside Glaze's container; the admin mounts the same host folder
 *   into Glaze and names it here. Because the admin chose this path
 *   explicitly, it may lie outside the config folder: the trade-off is that
 *   whatever folder is configured becomes editable (only referenced
 *   `.css`/`.js`/`.mjs` files, never anything above it).
 * - without it: `server.assets-path`, resolved from the config's folder, and
 *   only when it lies inside that folder, so a config alone can't point
 *   Glaze at arbitrary places on disk.
 * @param configPath - Path of `glance.yml`.
 * @param configText - The config on disk (decides which files are referenced).
 * @param name - The requested name.
 * @param assetsDir - Absolute `GLAZE_ASSETS_PATH`, or `null` to use `server.assets-path`.
 * @returns The absolute file path, or why it was refused.
 */
export function resolveAssetPath(
	configPath: string,
	configText: string,
	name: string,
	assetsDir: string | null = null,
): Result<string, AssetError> {
	if (!isSafeName(name)) {
		return err({ code: "invalid-name", message: `Invalid file name: ${name}` });
	}
	if (!findReferencedAssets(configText).some((entry) => entry.name === name)) {
		return err({
			code: "not-referenced",
			message: `${name} is not referenced by the config`,
		});
	}
	let folder: string;
	if (assetsDir !== null) {
		folder = resolve(assetsDir);
	} else {
		const assetsPath = stringAt(configText, ["server", "assets-path"]);
		if (assetsPath === null || assetsPath.includes("${")) {
			return err({
				code: "no-assets-path",
				message: "The config has no server.assets-path",
			});
		}
		const configDir = dirname(configPath);
		folder = resolve(configDir, assetsPath);
		if (!isInside(configDir, folder)) {
			return err({
				code: "outside-config-folder",
				message:
					"server.assets-path is outside the config's folder. In Docker, mount Glance's assets folder into Glaze as well and set GLAZE_ASSETS_PATH to it (see the README).",
			});
		}
	}
	const file = resolve(folder, name);
	// isSafeName already rules out `..`; this guards against anything it missed.
	if (!isInside(folder, file)) {
		return err({ code: "invalid-name", message: `Invalid file name: ${name}` });
	}
	return ok(file);
}

/**
 * Reads an asset file as UTF-8 text.
 * @param path - Absolute path from `resolveAssetPath`.
 * @param name - The asset name, echoed back.
 * @returns The text and version; a missing file gives `""` and version `null`.
 */
export async function readAsset(
	path: string,
	name: string,
): Promise<Result<AssetFile, AssetError>> {
	let bytes: Buffer;
	try {
		bytes = await readFile(path);
	} catch (error) {
		const code =
			error instanceof Error && "code" in error ? String(error.code) : "";
		if (code === "ENOENT") return ok({ name, text: "", version: null });
		const reason = error instanceof Error ? error.message : String(error);
		return err({ code: "io-error", params: { reason }, message: reason });
	}
	if (bytes.length > MAX_ASSET_BYTES) {
		return err({ code: "too-large", message: `${name} is larger than 1 MB` });
	}
	let text: string;
	try {
		text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return err({ code: "not-text", message: `${name} is not UTF-8 text` });
	}
	return ok({ name, text, version: hashText(text) });
}

/**
 * Writes an asset file, unless it changed since `baseVersion` was read.
 * @param path - Absolute path from `resolveAssetPath`.
 * @param name - The asset name.
 * @param text - New contents.
 * @param baseVersion - The version the edit started from (`null`: the file didn't exist).
 * @returns The new version, or a conflict with the version on disk.
 */
export async function writeAsset(
	path: string,
	name: string,
	text: string,
	baseVersion: string | null,
): Promise<
	Result<
		{ version: string },
		AssetError | { code: "conflict"; version: string | null; message: string }
	>
> {
	if (Buffer.byteLength(text, "utf8") > MAX_ASSET_BYTES) {
		return err({ code: "too-large", message: `${name} is larger than 1 MB` });
	}
	const current = await readAsset(path, name);
	// A file that isn't UTF-8 or is too big is never overwritten through the API.
	if (!current.ok) return current;
	if (current.value.version !== baseVersion) {
		return err({
			code: "conflict",
			version: current.value.version,
			message: `${name} changed on disk since it was loaded`,
		});
	}
	const written = await writeFileSafely(path, text);
	if (!written.ok) return written;
	return ok({ version: hashText(text) });
}
