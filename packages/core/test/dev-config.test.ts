import { describe, expect, it } from "vitest";
import { getModel, serializeConfig, validateLayout } from "../src/index.ts";
import { load } from "./helpers/line-diff.ts";

// Your own config with real values lives in the git-ignored `.dev/` folder.
// The import fails when the file is missing, so CI and other contributors skip this.
// The path is built at run time so Vite loads it fresh; a static import or glob
// would be baked into Vitest's transform cache and miss later changes to the file.
// A bare relative string would resolve from the wrong folder, so build a file URL
// from this file's own URL (no `URL` class: core has no DOM or Node types).
const repoRoot = import.meta.url.slice(
	0,
	import.meta.url.lastIndexOf("/packages/core/"),
);
const devConfigPath = `${repoRoot}/.dev/glance.yml?raw`;
const devConfig = await import(/* @vite-ignore */ devConfigPath).then(
	(module: { default: string }) => module.default,
	() => undefined,
);

describe.skipIf(devConfig === undefined)(".dev/glance.yml", () => {
	const text = devConfig ?? "";

	it("round-trips byte for byte", () => {
		expect(serializeConfig(load(text))).toBe(text);
	});

	it("has a valid layout and at least one page", () => {
		const doc = load(text);
		expect(validateLayout(doc)).toEqual([]);
		expect(getModel(doc).length).toBeGreaterThan(0);
	});
});
