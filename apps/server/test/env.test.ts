import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readServerEnv } from "../src/env.ts";

const ROOT = resolve("/repo");

describe("readServerEnv", () => {
	it("uses .dev/glance.yml and port 8090 by default", () => {
		expect(readServerEnv({}, ROOT)).toEqual({
			ok: true,
			value: { configPath: resolve(ROOT, ".dev/glance.yml"), port: 8090 },
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
});
