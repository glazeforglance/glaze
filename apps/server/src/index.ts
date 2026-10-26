import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { resolveAuthConfig } from "./auth-config.ts";
import { loadDotEnv, REPO_ROOT, readServerEnv } from "./env.ts";
import { GLAZE_VERSION } from "./version.ts";

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
	const { configPath, port, glanceBin, glanceUrl, trustProxy } = env.value;
	for (const warning of env.value.warnings) console.warn(`Warning: ${warning}`);

	const auth = await resolveAuthConfig(env.value.auth, dirname(configPath));
	if (!auth.ok) fail(auth.error);

	const app = createApp({
		configPath,
		glance: glanceBin === null ? null : { bin: glanceBin },
		glanceUrl,
		auth: auth.value,
		trustProxy,
		version: GLAZE_VERSION,
	});

	serve({ fetch: app.fetch, port }, (info) => {
		console.log(`Glaze ${GLAZE_VERSION} on http://localhost:${info.port}`);
		console.log(`Editing ${configPath}`);
		console.log(
			glanceBin === null
				? "Glance validation is off (set GLANCE_BIN)"
				: "Glance validation is on",
		);
		if (auth.value !== null) {
			console.log(`Login required (user "${auth.value.username}")`);
		}
	});
}

await main();
