import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { resolveAuthConfig } from "../src/auth-config.ts";
import {
	createSessionToken,
	passwordTag,
	SESSION_LIFETIME_MS,
} from "../src/session.ts";
import {
	fastHash,
	logIn,
	TEST_PASSWORD,
	TEST_SECRET,
	TEST_USER,
	testAuth,
} from "./helpers/session.ts";

const CONFIG = "pages:\n  - name: Home\n    columns:\n      - size: full\n";
const DAY = 24 * 60 * 60 * 1000;

let dir: string;
let configPath: string;
let time: number;
const now = () => time;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "glaze-auth-"));
	configPath = join(dir, "glance.yml");
	await writeFile(configPath, CONFIG, "utf8");
	time = 1_800_000_000_000;
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

async function app(options: { trustProxy?: boolean } = {}) {
	return createApp({ configPath, auth: await testAuth(), now, ...options });
}

function withCookie(
	cookie: string | null,
	init: RequestInit = {},
): RequestInit {
	const headers = new Headers(init.headers);
	headers.set("Cookie", cookie ?? "");
	return { ...init, headers };
}

function login(
	username: string,
	password: string,
	headers: Record<string, string> = {},
): RequestInit {
	return {
		method: "POST",
		headers: { "Content-Type": "application/json", ...headers },
		body: JSON.stringify({ username, password }),
	};
}

describe("protected routes", () => {
	it("answer 401 JSON without a session", async () => {
		const glaze = await app();
		for (const path of ["/api/config", "/api/files", "/api/settings"]) {
			const res = await glaze.request(path);
			expect(res.status, path).toBe(401);
			expect(await res.json()).toMatchObject({ error: "unauthorized" });
		}
		const put = await glaze.request("/api/config", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		});
		expect(put.status).toBe(401);
	});

	it("answer 401 for unknown /api routes too, so nothing leaks", async () => {
		expect((await (await app()).request("/api/nope")).status).toBe(401);
	});

	it("keep /api/healthz public", async () => {
		const res = await createApp({
			configPath,
			auth: await testAuth(),
			version: "1.2.3",
		}).request("/api/healthz");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true, version: "1.2.3" });
	});
});

describe("POST /api/auth/login", () => {
	it("sets a strict, HttpOnly session cookie", async () => {
		const res = await (await app()).request(
			"/api/auth/login",
			login(TEST_USER, TEST_PASSWORD),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ authenticated: true, user: TEST_USER });
		const cookie = res.headers.get("set-cookie") ?? "";
		expect(cookie).toMatch(/^glaze_session=[^;]+/);
		expect(cookie).toMatch(/HttpOnly/);
		expect(cookie).toMatch(/SameSite=Strict/);
		expect(cookie).toMatch(/Path=\//);
		expect(cookie).toMatch(/Max-Age=1209600/);
		// Plain HTTP: no Secure flag, or browsers would drop the cookie.
		expect(cookie).not.toMatch(/Secure/);
	});

	it("gives the same answer for a wrong user and a wrong password", async () => {
		const glaze = await app();
		const wrongPassword = await glaze.request(
			"/api/auth/login",
			login(TEST_USER, "nope"),
		);
		const wrongUser = await glaze.request(
			"/api/auth/login",
			login("root", TEST_PASSWORD),
		);
		expect(wrongPassword.status).toBe(401);
		expect(wrongUser.status).toBe(401);
		expect(await wrongPassword.json()).toEqual(await wrongUser.json());
		expect(wrongPassword.headers.get("set-cookie")).toBeNull();
	});

	it("answers 400 for a malformed body", async () => {
		const res = await (await app()).request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username: TEST_USER }),
		});
		expect(res.status).toBe(400);
	});

	it("marks the cookie Secure behind an HTTPS proxy, only when trusted", async () => {
		const https = { "X-Forwarded-Proto": "https" };
		const trusted = await (await app({ trustProxy: true })).request(
			"/api/auth/login",
			login(TEST_USER, TEST_PASSWORD, https),
		);
		expect(trusted.headers.get("set-cookie")).toMatch(/Secure/);
		const untrusted = await (await app()).request(
			"/api/auth/login",
			login(TEST_USER, TEST_PASSWORD, https),
		);
		expect(untrusted.headers.get("set-cookie")).not.toMatch(/Secure/);
	});
});

describe("rate limit", () => {
	it("refuses the 6th attempt in 5 minutes with 429 and Retry-After", async () => {
		const glaze = await app();
		for (let i = 0; i < 5; i++) {
			const res = await glaze.request("/api/auth/login", login(TEST_USER, "x"));
			expect(res.status).toBe(401);
		}
		// Even the right password is refused while limited.
		const limited = await glaze.request(
			"/api/auth/login",
			login(TEST_USER, TEST_PASSWORD),
		);
		expect(limited.status).toBe(429);
		expect(limited.headers.get("retry-after")).toBe("300");
		time += 5 * 60_000;
		const later = await glaze.request(
			"/api/auth/login",
			login(TEST_USER, TEST_PASSWORD),
		);
		expect(later.status).toBe(200);
	});

	it("counts per client IP behind a trusted proxy", async () => {
		const glaze = await app({ trustProxy: true });
		const from = (ip: string) => ({ "CF-Connecting-IP": ip });
		for (let i = 0; i < 5; i++) {
			await glaze.request(
				"/api/auth/login",
				login(TEST_USER, "x", from("1.1.1.1")),
			);
		}
		const blocked = await glaze.request(
			"/api/auth/login",
			login(TEST_USER, TEST_PASSWORD, from("1.1.1.1")),
		);
		const other = await glaze.request(
			"/api/auth/login",
			login(TEST_USER, TEST_PASSWORD, from("2.2.2.2")),
		);
		expect(blocked.status).toBe(429);
		expect(other.status).toBe(200);
	});

	it("uses the last X-Forwarded-For entry, which the client can't fake", async () => {
		const glaze = await app({ trustProxy: true });
		for (let i = 0; i < 5; i++) {
			// A client making up a new first entry each time is still one IP.
			await glaze.request(
				"/api/auth/login",
				login(TEST_USER, "x", { "X-Forwarded-For": `10.0.0.${i}, 9.9.9.9` }),
			);
		}
		const res = await glaze.request(
			"/api/auth/login",
			login(TEST_USER, TEST_PASSWORD, {
				"X-Forwarded-For": "10.0.0.99, 9.9.9.9",
			}),
		);
		expect(res.status).toBe(429);
	});
});

describe("sessions", () => {
	it("give access to protected routes", async () => {
		const glaze = await app();
		const { cookie } = await logIn(glaze);
		const res = await glaze.request("/api/config", withCookie(cookie));
		expect(res.status).toBe(200);
		const session = await glaze.request(
			"/api/auth/session",
			withCookie(cookie),
		);
		expect(await session.json()).toEqual({
			authenticated: true,
			user: TEST_USER,
			authDisabled: false,
		});
	});

	it("report anonymous without a cookie", async () => {
		const res = await (await app()).request("/api/auth/session");
		expect(await res.json()).toEqual({
			authenticated: false,
			user: null,
			authDisabled: false,
		});
	});

	it("refuse a tampered cookie", async () => {
		const glaze = await app();
		const { cookie } = await logIn(glaze);
		const value = (cookie ?? "").slice("glaze_session=".length);
		const [data = "", signature = ""] = value.split(".");
		const payload = JSON.parse(
			Buffer.from(data, "base64url").toString("utf8"),
		) as { exp: number };
		const forged = Buffer.from(
			JSON.stringify({ ...payload, exp: payload.exp + 100 * DAY }),
		).toString("base64url");
		const res = await glaze.request(
			"/api/config",
			withCookie(`glaze_session=${forged}.${signature}`),
		);
		expect(res.status).toBe(401);
	});

	it("refuse a cookie signed with another secret", async () => {
		const other = "another-secret-0123456789abcdefghijk";
		const auth = await testAuth();
		const token = createSessionToken(
			{
				user: TEST_USER,
				exp: time + 60_000,
				pwdTag: passwordTag(other, auth.passwordHash),
			},
			other,
		);
		const res = await (await app()).request(
			"/api/config",
			withCookie(`glaze_session=${token}`),
		);
		expect(res.status).toBe(401);
	});

	it("expire after 14 days", async () => {
		const glaze = await app();
		const { cookie } = await logIn(glaze);
		time += SESSION_LIFETIME_MS;
		const res = await glaze.request("/api/config", withCookie(cookie));
		expect(res.status).toBe(401);
	});

	it("are renewed when less than 7 days are left", async () => {
		const glaze = await app();
		const { cookie } = await logIn(glaze);
		time += 6 * DAY;
		const early = await glaze.request("/api/config", withCookie(cookie));
		expect(early.headers.get("set-cookie")).toBeNull();
		time += 2 * DAY;
		const late = await glaze.request("/api/config", withCookie(cookie));
		expect(late.status).toBe(200);
		expect(late.headers.get("set-cookie")).toMatch(/^glaze_session=/);
	});

	it("end when the password changes", async () => {
		const { cookie } = await logIn(await app());
		// Same secret, new hash: like a restart with a new GLAZE_ADMIN_PASSWORD_HASH.
		const after = createApp({
			configPath,
			now,
			auth: await testAuth({ passwordHash: await fastHash("a new password") }),
		});
		const res = await after.request("/api/config", withCookie(cookie));
		expect(res.status).toBe(401);
	});

	it("survive a restart with the same secret and password", async () => {
		const { cookie } = await logIn(await app());
		const res = await (await app()).request("/api/config", withCookie(cookie));
		expect(res.status).toBe(200);
	});

	it("end on logout", async () => {
		const res = await (await app()).request("/api/auth/logout", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("set-cookie")).toMatch(
			/^glaze_session=;.*Max-Age=0/,
		);
	});
});

describe("CSRF", () => {
	it("refuses a form-style POST from another origin", async () => {
		const glaze = await app();
		const { cookie } = await logIn(glaze);
		const res = await glaze.request(
			"/api/validate",
			withCookie(cookie, {
				method: "POST",
				headers: {
					"Content-Type": "text/plain",
					Origin: "https://evil.example",
				},
				body: JSON.stringify({ text: CONFIG }),
			}),
		);
		expect(res.status).toBe(403);
	});

	it("refuses a cross-site login form", async () => {
		const res = await (await app()).request("/api/auth/login", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Origin: "https://evil.example",
			},
			body: "username=admin&password=x",
		});
		expect(res.status).toBe(403);
	});

	it("accepts the same origin", async () => {
		const glaze = await app();
		const { cookie } = await logIn(glaze);
		const res = await glaze.request(
			"http://localhost/api/validate",
			withCookie(cookie, {
				method: "POST",
				headers: { "Content-Type": "text/plain", Origin: "http://localhost" },
				body: JSON.stringify({ text: CONFIG }),
			}),
		);
		expect(res.status).toBe(200);
	});

	it("accepts the proxy's public origin only with GLAZE_TRUST_PROXY", async () => {
		const request = (): RequestInit => ({
			method: "POST",
			headers: {
				"Content-Type": "text/plain",
				Origin: "https://glaze.example.com",
				"X-Forwarded-Proto": "https",
			},
			body: JSON.stringify({ username: TEST_USER, password: TEST_PASSWORD }),
		});
		const url = "http://glaze.example.com/api/auth/login";
		const trusted = await (await app({ trustProxy: true })).request(
			url,
			request(),
		);
		const untrusted = await (await app()).request(url, request());
		expect(trusted.status).toBe(200);
		expect(untrusted.status).toBe(403);
	});
});

describe("security headers", () => {
	it("send a CSP with the Glance origin for the preview", async () => {
		const res = await createApp({
			configPath,
			auth: await testAuth(),
			glanceUrl: "http://glance.local:8080/sub",
		}).request("/api/healthz");
		const csp = res.headers.get("content-security-policy") ?? "";
		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain("frame-src http://glance.local:8080");
		expect(csp).toContain("connect-src 'self' http://glance.local:8080");
		expect(csp).toContain("frame-ancestors 'none'");
		expect(csp).toMatch(/style-src 'self' 'nonce-[^']+'/);
		expect(csp).not.toContain("unsafe-inline");
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
	});

	it("block framing entirely without GLANCE_URL", async () => {
		const res = await (await app()).request("/api/healthz");
		expect(res.headers.get("content-security-policy")).toContain(
			"frame-src 'none'",
		);
	});
});

describe("GLAZE_AUTH=off", () => {
	it("opens every route and says so", async () => {
		const glaze = createApp({ configPath, auth: null });
		expect((await glaze.request("/api/config")).status).toBe(200);
		const session = await glaze.request("/api/auth/session");
		expect(await session.json()).toEqual({
			authenticated: true,
			user: null,
			authDisabled: true,
		});
	});
});

describe("resolveAuthConfig", () => {
	it("creates .glaze/secret once and reuses it", async () => {
		const env = {
			mode: "on",
			username: "admin",
			passwordHash: await fastHash("pw-pw-pw-pw"),
			plainPassword: null,
			secret: null,
		} as const;
		const first = await resolveAuthConfig(env, dir);
		const second = await resolveAuthConfig(env, dir);
		if (!first.ok || !second.ok) throw new Error("no secret");
		expect(first.value?.secret).toMatch(/^[\w-]{43}$/);
		expect(second.value?.secret).toBe(first.value?.secret);
	});

	it("derives a stable hash from a plain password, so sessions survive restarts", async () => {
		const env = {
			mode: "on",
			username: "admin",
			passwordHash: null,
			plainPassword: "plain text password",
			secret: TEST_SECRET,
		} as const;
		const a = await resolveAuthConfig(env, dir);
		const b = await resolveAuthConfig(env, dir);
		if (!a.ok || !b.ok || a.value === null) throw new Error("no auth config");
		expect(a.value.passwordHash).toMatch(/^scrypt\$/);
		expect(b.value?.passwordHash).toBe(a.value.passwordHash);
		const res = await createApp({ configPath, auth: a.value }).request(
			"/api/auth/login",
			login("admin", "plain text password"),
		);
		expect(res.status).toBe(200);
	});

	it("returns null when auth is off", async () => {
		expect(await resolveAuthConfig({ mode: "off" }, dir)).toEqual({
			ok: true,
			value: null,
		});
	});
});
