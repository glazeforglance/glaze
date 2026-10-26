import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	DEFAULT_WEB_DIST,
	type ReadTextFile,
	readServerEnv,
} from "../src/env.ts";
import { MANGLED_HASH_HINT } from "../src/password.ts";

const ROOT = resolve("/repo");
// A well-formed fake hash (salt "saltsalt", hash of 16 bytes); not a real password.
const HASH = "scrypt:1024:8:1:c2FsdHNhbHQ:aGFzaGhhc2hoYXNoaGFzaA";
/** The minimum env to start: a password hash. */
const BASE = { GLAZE_ADMIN_PASSWORD_HASH: HASH };

describe("readServerEnv", () => {
	it("uses .dev/glance.yml and port 8090 by default", () => {
		expect(readServerEnv(BASE, ROOT)).toEqual({
			ok: true,
			value: {
				configPath: resolve(ROOT, ".dev/glance.yml"),
				port: 8090,
				glanceBin: null,
				glanceUrl: null,
				auth: {
					mode: "on",
					username: "admin",
					passwordHash: HASH,
					plainPassword: null,
					secret: null,
				},
				trustProxy: false,
				webDist: DEFAULT_WEB_DIST,
				production: false,
				warnings: [],
			},
		});
	});

	it("resolves relative paths from the root and keeps absolute ones", () => {
		const relative = readServerEnv(
			{ ...BASE, GLAZE_CONFIG_PATH: "config/glance.yml" },
			ROOT,
		);
		expect(relative.ok && relative.value.configPath).toBe(
			resolve(ROOT, "config/glance.yml"),
		);
		const absolute = resolve("/srv/glance/glance.yml");
		const result = readServerEnv(
			{ ...BASE, GLAZE_CONFIG_PATH: absolute },
			ROOT,
		);
		expect(result.ok && result.value.configPath).toBe(absolute);
	});

	it("rejects an invalid port", () => {
		expect(readServerEnv({ ...BASE, GLAZE_PORT: "abc" }, ROOT).ok).toBe(false);
		expect(readServerEnv({ ...BASE, GLAZE_PORT: "70000" }, ROOT).ok).toBe(
			false,
		);
		const port = readServerEnv({ ...BASE, GLAZE_PORT: "9000" }, ROOT);
		expect(port.ok && port.value.port).toBe(9000);
	});

	it("ignores a generic PORT set by other tools", () => {
		const result = readServerEnv({ ...BASE, PORT: "5173" }, ROOT);
		expect(result.ok && result.value.port).toBe(8090);
	});

	it("reads the optional GLANCE_BIN, GLANCE_URL and GLAZE_WEB_DIST", () => {
		const result = readServerEnv(
			{
				...BASE,
				GLANCE_BIN: "bin/glance",
				GLANCE_URL: "http://localhost:8080/",
				GLAZE_WEB_DIST: "web",
			},
			ROOT,
		);
		expect(result.ok && result.value.glanceBin).toBe(
			resolve(ROOT, "bin/glance"),
		);
		expect(result.ok && result.value.glanceUrl).toBe("http://localhost:8080");
		expect(result.ok && result.value.webDist).toBe(resolve(ROOT, "web"));
	});

	it("rejects a GLANCE_URL that isn't http(s)", () => {
		expect(
			readServerEnv({ ...BASE, GLANCE_URL: "glance.local" }, ROOT).ok,
		).toBe(false);
		expect(readServerEnv({ ...BASE, GLANCE_URL: "ftp://x" }, ROOT).ok).toBe(
			false,
		);
	});

	it("reads GLAZE_TRUST_PROXY as true/false only", () => {
		const on = readServerEnv({ ...BASE, GLAZE_TRUST_PROXY: "true" }, ROOT);
		expect(on.ok && on.value.trustProxy).toBe(true);
		expect(readServerEnv({ ...BASE, GLAZE_TRUST_PROXY: "yes" }, ROOT).ok).toBe(
			false,
		);
	});
});

describe("readServerEnv auth", () => {
	it("refuses to start without a password, explaining how to set one", () => {
		const result = readServerEnv({}, ROOT);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.error).toMatch(/hash-password/);
		expect(!result.ok && result.error).toMatch(/GLAZE_ADMIN_PASSWORD_HASH/);
	});

	it("refuses a malformed hash", () => {
		const result = readServerEnv(
			{ GLAZE_ADMIN_PASSWORD_HASH: "not-a-hash" },
			ROOT,
		);
		expect(result.ok).toBe(false);
		// The value itself is never echoed back into logs.
		expect(!result.ok && result.error).not.toContain("not-a-hash");
	});

	it("accepts a plain password with a warning", () => {
		const result = readServerEnv(
			{ GLAZE_ADMIN_PASSWORD: "plain secret value" },
			ROOT,
		);
		if (!result.ok) throw new Error(result.error);
		expect(result.value.auth).toMatchObject({
			mode: "on",
			passwordHash: null,
			plainPassword: "plain secret value",
		});
		expect(result.value.warnings.join(" ")).toMatch(
			/GLAZE_ADMIN_PASSWORD_HASH/,
		);
		expect(result.value.warnings.join(" ")).not.toContain("plain secret value");
	});

	it("prefers the hash when both are set", () => {
		const result = readServerEnv(
			{ ...BASE, GLAZE_ADMIN_PASSWORD: "plain secret value" },
			ROOT,
		);
		if (!result.ok) throw new Error(result.error);
		expect(result.value.auth).toMatchObject({
			passwordHash: HASH,
			plainPassword: null,
		});
		expect(result.value.warnings).toHaveLength(1);
	});

	it("reads the username and secret", () => {
		const secret = "s".repeat(32);
		const result = readServerEnv(
			{ ...BASE, GLAZE_ADMIN_USERNAME: "sean", GLAZE_SECRET: secret },
			ROOT,
		);
		expect(result.ok && result.value.auth).toMatchObject({
			username: "sean",
			secret,
		});
	});

	it("refuses a short GLAZE_SECRET", () => {
		expect(readServerEnv({ ...BASE, GLAZE_SECRET: "short" }, ROOT).ok).toBe(
			false,
		);
	});

	it("allows GLAZE_AUTH=off in development, without a password", () => {
		const result = readServerEnv({ GLAZE_AUTH: "off" }, ROOT);
		expect(result.ok && result.value.auth).toEqual({ mode: "off" });
		expect(result.ok && result.value.warnings.join(" ")).toMatch(/OFF/);
	});

	it("refuses GLAZE_AUTH=off in production", () => {
		const result = readServerEnv(
			{ ...BASE, GLAZE_AUTH: "off", NODE_ENV: "production" },
			ROOT,
		);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.error).toMatch(/production/);
	});

	it("rejects unknown GLAZE_AUTH values", () => {
		expect(readServerEnv({ ...BASE, GLAZE_AUTH: "maybe" }, ROOT).ok).toBe(
			false,
		);
	});
});

/** A fake file system for `_FILE` tests: no real files needed. */
function files(contents: Record<string, string>): ReadTextFile {
	return (path) => {
		const key = path.replaceAll("\\", "/");
		const match = Object.entries(contents).find(([name]) => key.endsWith(name));
		if (!match) {
			throw Object.assign(new Error("ENOENT: no such file"), {
				code: "ENOENT",
			});
		}
		return match[1];
	};
}

describe("readServerEnv _FILE variants", () => {
	it("reads GLAZE_ADMIN_PASSWORD_HASH_FILE and trims the newline", () => {
		const result = readServerEnv(
			{ GLAZE_ADMIN_PASSWORD_HASH_FILE: "/run/secrets/glaze_hash" },
			ROOT,
			files({ "/run/secrets/glaze_hash": `${HASH}\n` }),
		);
		expect(result.ok && result.value.auth).toMatchObject({
			mode: "on",
			passwordHash: HASH,
		});
	});

	it("reads GLAZE_ADMIN_PASSWORD_FILE and GLAZE_SECRET_FILE", () => {
		const secret = "f".repeat(40);
		const result = readServerEnv(
			{
				GLAZE_ADMIN_PASSWORD_FILE: "secrets/password.txt",
				GLAZE_SECRET_FILE: "secrets/secret.txt",
			},
			ROOT,
			files({
				"secrets/password.txt": "  long file password \r\n",
				"secrets/secret.txt": `${secret}\n`,
			}),
		);
		expect(result.ok && result.value.auth).toMatchObject({
			plainPassword: "long file password",
			secret,
		});
	});

	it("resolves relative _FILE paths from the root", () => {
		const seen: string[] = [];
		readServerEnv(
			{ GLAZE_ADMIN_PASSWORD_HASH_FILE: "hash.txt" },
			ROOT,
			(path) => {
				seen.push(path);
				return HASH;
			},
		);
		expect(seen).toEqual([resolve(ROOT, "hash.txt")]);
	});

	it.each([
		"GLAZE_ADMIN_PASSWORD",
		"GLAZE_ADMIN_PASSWORD_HASH",
		"GLAZE_SECRET",
	])("refuses %s together with %s_FILE", (name) => {
		const result = readServerEnv(
			{
				...BASE,
				[name]: name === "GLAZE_SECRET" ? "s".repeat(32) : HASH,
				[`${name}_FILE`]: "/x",
			},
			ROOT,
			files({ "/x": HASH }),
		);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.error).toBe(
			`Both ${name} and ${name}_FILE are set. Use one of them.`,
		);
	});

	it("names the path of a missing file, but nothing of its contents", () => {
		const result = readServerEnv(
			{ GLAZE_ADMIN_PASSWORD_HASH_FILE: "/run/secrets/missing" },
			ROOT,
			files({}),
		);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.error).toMatch(
			/GLAZE_ADMIN_PASSWORD_HASH_FILE/,
		);
		expect(!result.ok && result.error).toMatch(/missing/);
		expect(!result.ok && result.error).toMatch(/ENOENT/);
	});

	it("refuses an empty file", () => {
		const result = readServerEnv(
			{ GLAZE_ADMIN_PASSWORD_HASH_FILE: "/empty" },
			ROOT,
			files({ "/empty": " \n" }),
		);
		expect(!result.ok && result.error).toMatch(/is empty/);
	});

	it("validates a hash from a file like any other, without echoing it", () => {
		const result = readServerEnv(
			{ GLAZE_ADMIN_PASSWORD_HASH_FILE: "/h" },
			ROOT,
			files({ "/h": "scrypt$32768$8$1===" }),
		);
		expect(!result.ok && result.error).toContain(MANGLED_HASH_HINT);
		expect(!result.ok && result.error).not.toContain("===");
	});
});

describe("readServerEnv with a mangled hash", () => {
	it("explains what Compose did to a v0.1.0 hash", () => {
		const result = readServerEnv(
			{ GLAZE_ADMIN_PASSWORD_HASH: "scrypt$32768$8$1===" },
			ROOT,
		);
		expect(!result.ok && result.error).toBe(
			`GLAZE_ADMIN_PASSWORD_HASH is invalid: ${MANGLED_HASH_HINT}`,
		);
	});
});
