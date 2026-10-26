import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { loadDotEnv, REPO_ROOT, readServerEnv } from "./env.ts";

loadDotEnv(REPO_ROOT);
const env = readServerEnv(process.env, REPO_ROOT);
if (!env.ok) {
	console.error(env.error);
	process.exit(1);
}
const { configPath, port, glanceBin, glanceUrl } = env.value;

const app = createApp({
	configPath,
	glance: glanceBin === null ? null : { bin: glanceBin },
	glanceUrl,
});

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`Glaze API on http://localhost:${info.port}`);
	console.log(`Editing ${configPath}`);
	console.log(
		glanceBin === null
			? "Glance validation is off (set GLANCE_BIN)"
			: "Glance validation is on",
	);
});
