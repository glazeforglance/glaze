import { readFileSync } from "node:fs";

// Replaced with a string literal by esbuild (see build.ts); undefined under tsx.
declare const __GLAZE_VERSION__: string | undefined;

function versionFromPackageJson(): string {
	try {
		const raw = readFileSync(
			new URL("../../../package.json", import.meta.url),
			"utf8",
		);
		const version: unknown = (JSON.parse(raw) as Record<string, unknown>)
			.version;
		return typeof version === "string" ? version : "dev";
	} catch {
		return "dev";
	}
}

/** Glaze's version: injected at build time, read from the root `package.json` in development. */
export const GLAZE_VERSION: string =
	typeof __GLAZE_VERSION__ === "string"
		? __GLAZE_VERSION__
		: versionFromPackageJson();
