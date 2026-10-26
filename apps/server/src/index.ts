import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { resolveAuthConfig } from "./auth-config.ts";
import { waitForPendingWrites } from "./config-store.ts";
import { loadDotEnv, REPO_ROOT, readServerEnv } from "./env.ts";
import { checkAssetsAccess, checkConfigAccess } from "./startup-check.ts";
import { hasWebApp } from "./static.ts";
import { GLAZE_VERSION } from "./version.ts";

// After this long, shutdown stops waiting for open connections and writes.
const SHUTDOWN_TIMEOUT_MS = 10_000;

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

async function main(): Promise<void> {
	// `docker run <image> hash-password` passes it as the first argument.
	if (process.argv[2] === "hash-password") {
		const { runHashPassword } = await import("./hash-password.ts");
		process.exitCode = await runHashPassword();
		return;
	}

	loadDotEnv(REPO_ROOT);
	const env = readServerEnv(process.env, REPO_ROOT);
	if (!env.ok) fail(env.error);
	const {
		configPath,
		port,
		glanceBin,
		glanceUrl,
		trustProxy,
		webDist,
		assetsPath,
	} = env.value;
	for (const warning of env.value.warnings) console.warn(`Warning: ${warning}`);

	// Before the secret: it's created in the same folder.
	const access = await checkConfigAccess(configPath);
	if (!access.ok) fail(access.error);
	if (assetsPath !== null) {
		const assets = await checkAssetsAccess(assetsPath);
		if (!assets.ok) fail(assets.error);
	}

	const auth = await resolveAuthConfig(env.value.auth, dirname(configPath));
	if (!auth.ok) fail(auth.error);

	const serveWeb = hasWebApp(webDist);
	const app = createApp({
		configPath,
		glance: glanceBin === null ? null : { bin: glanceBin },
		glanceUrl,
		auth: auth.value,
		trustProxy,
		assetsPath,
		version: GLAZE_VERSION,
		webDist: serveWeb ? webDist : null,
	});

	const server = serve({ fetch: app.fetch, port }, (info) => {
		console.log(`Glaze ${GLAZE_VERSION} on http://localhost:${info.port}`);
		console.log(`Editing ${configPath}`);
		if (assetsPath !== null) console.log(`Asset files in ${assetsPath}`);
		console.log(
			serveWeb
				? `Serving the web app from ${webDist}`
				: "API only (no web build found; use `pnpm dev` or `pnpm build`)",
		);
		console.log(
			glanceBin === null
				? "Glance validation is off (set GLANCE_BIN)"
				: "Glance validation is on",
		);
		if (auth.value !== null) {
			console.log(`Login required (user "${auth.value.username}")`);
		}
	});

	let stopping = false;
	const shutdown = (signal: string) => {
		if (stopping) return;
		stopping = true;
		console.log(`${signal} received, shutting down…`);
		// Hard stop if a connection or write hangs; Docker sends SIGKILL after 10 s anyway.
		setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
		// Stop accepting connections; requests in progress (e.g. a Publish) finish first.
		server.close(() => {
			void waitForPendingWrites().then(() => process.exit(0));
		});
		if ("closeIdleConnections" in server) server.closeIdleConnections();
	};
	process.on("SIGTERM", () => shutdown("SIGTERM"));
	process.on("SIGINT", () => shutdown("SIGINT"));
}

await main();
