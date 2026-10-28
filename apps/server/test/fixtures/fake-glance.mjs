// Stand-in for the Glance binary in tests: `node fake-glance.mjs --config <file> config:validate`.
// What it prints depends on a `# fake: <mode>` comment in the config.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const at = args.indexOf("--config");
const configPath = args[at + 1];
if (at === -1 || args[at + 2] !== "config:validate" || !configPath) {
	console.log(`fake-glance: unexpected arguments ${args.join(" ")}`);
	process.exit(2);
}

const text = readFileSync(configPath, "utf8");
const mode = /# fake: ([a-z-]+)/.exec(text)?.[1] ?? "ok";
const names = [...text.matchAll(/\$\{([A-Z0-9_]+)\}/g)].map(
	(match) => match[1],
);

if (mode === "record") {
	// Tells the test which file it got and which values the variables had.
	const env = Object.fromEntries(
		names.map((name) => [name, process.env[name]]),
	);
	writeFileSync(
		process.env.FAKE_GLANCE_RECORD ?? "",
		JSON.stringify({ configPath, text, env }),
	);
	process.exit(0);
}

// Like Glance: every ${NAME} must be set, comments included.
for (const name of names) {
	if (process.env[name] === undefined) {
		console.log(
			`Config file is invalid: parsing variable: environment variable ${name} not found`,
		);
		process.exit(1);
	}
}
if (/\$\{(?:secret|readFileFromEnv):/.test(text)) {
	console.log(
		"Config file is invalid: parsing variable: reading secret file: open /run/secrets/x: no such file or directory",
	);
	process.exit(1);
}

// Like Glance (config.go): a set `server.assets-path` must exist, relative to the cwd.
const assets = /^\s+assets-path:[ \t]*(.+?)(?:[ \t]+#.*)?\s*$/m.exec(text)?.[1];
if (assets !== undefined) {
	const path = assets.startsWith('"')
		? JSON.parse(assets)
		: assets.replace(/^'(.*)'$/, "$1");
	if (!existsSync(path)) {
		console.log(
			`Config file is invalid: assets directory does not exist: ${path}`,
		);
		process.exit(1);
	}
}

switch (mode) {
	case "yaml-error":
		console.log(
			"Could not parse config file: yaml: line 3: did not find expected key",
		);
		process.exit(1);
		break;
	case "column-size":
		console.log(
			"Config file is invalid: column 2 of page 1: size can only be either small or full",
		);
		process.exit(1);
		break;
	case "secret-file":
		console.log(
			"Config file is invalid: parsing variable: reading secret file: open /run/secrets/token: no such file or directory",
		);
		process.exit(1);
		break;
	case "garbage":
		console.log("panic: something unexpected");
		process.exit(2);
		break;
	case "timeout":
		setTimeout(() => process.exit(0), 60_000);
		break;
	default:
		process.exit(0);
}
