import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readServerEnv } from "../src/env.ts";

const ROOT = resolve("/repo");

describe("readServerEnv", () => {
	it("uses .dev/glance.yml and port 8090 by default", () => {
		expect(readServerEnv({}, ROOT)).toEqual({
			ok: true,
			value: {
				configPath: resolve(ROOT, ".dev/glance.yml"),
				port: 8090,
				glanceBin: null,
				glanceUrl: null,
			},
		});
	});

	it("resolves relative paths from the root and keeps absolute ones", () => {
		const relative = readServerEnv(
			{ GLAZE_CONFIG_PATH: "config/glance.yml" },
			ROOT,
		);
		expect(relative.ok && relative.value.configPath).toBe(
			resolve(ROOT, "config/glance.yml"),
		);
		const absolute = resolve("/srv/glance/glance.yml");
		const result = readServerEnv({ GLAZE_CONFIG_PATH: absolute }, ROOT);
		expect(result.ok && result.value.configPath).toBe(absolute);
	});

	it("rejects an invalid port", () => {
		expect(readServerEnv({ GLAZE_PORT: "abc" }, ROOT).ok).toBe(false);
		expect(readServerEnv({ GLAZE_PORT: "70000" }, ROOT).ok).toBe(false);
		const port = readServerEnv({ GLAZE_PORT: "9000" }, ROOT);
		expect(port.ok && port.value.port).toBe(9000);
	});

	it("ignores a generic PORT set by other tools", () => {
		const result = readServerEnv({ PORT: "5173" }, ROOT);
		expect(result.ok && result.value.port).toBe(8090);
	});

	it("reads the optional GLANCE_BIN and GLANCE_URL", () => {
		const result = readServerEnv(
			{ GLANCE_BIN: "bin/glance", GLANCE_URL: "http://localhost:8080/" },
			ROOT,
		);
		expect(result.ok && result.value.glanceBin).toBe(
			resolve(ROOT, "bin/glance"),
		);
		expect(result.ok && result.value.glanceUrl).toBe("http://localhost:8080");
	});

	it("rejects a GLANCE_URL that isn't http(s)", () => {
		expect(readServerEnv({ GLANCE_URL: "glance.local" }, ROOT).ok).toBe(false);
		expect(readServerEnv({ GLANCE_URL: "ftp://x" }, ROOT).ok).toBe(false);
	});
});
