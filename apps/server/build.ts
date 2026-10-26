import { readFileSync, rmSync } from "node:fs";
import { build } from "esbuild";

// Bundles the server into dist/ for production: Node can't run the
// TypeScript that @glaze/core exports, so everything (core, hono, yaml)
// goes into the bundle and dist/ needs no node_modules at runtime.

const rootPackage = JSON.parse(
	readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

rmSync(new URL("./dist", import.meta.url), { recursive: true, force: true });

await build({
	entryPoints: { index: "src/index.ts", cli: "src/cli.ts" },
	outdir: "dist",
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node24",
	sourcemap: true,
	// The bundle tells /api/healthz and the startup log which version it is.
	define: { __GLAZE_VERSION__: JSON.stringify(rootPackage.version) },
	// Bundled CommonJS code may call require(); ESM output has no require of its own.
	banner: {
		js: 'import { createRequire as __glazeCreateRequire } from "node:module"; const require = __glazeCreateRequire(import.meta.url);',
	},
	logLevel: "info",
});
