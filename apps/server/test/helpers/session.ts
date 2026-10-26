import type { Hono } from "hono";
import { type AppOptions, createApp } from "../../src/app.ts";
import type { AuthConfig } from "../../src/auth.ts";
import { hashPassword } from "../../src/password.ts";

// Fake test credentials only.
export const TEST_USER = "admin";
export const TEST_PASSWORD = "correct horse battery staple";
export const TEST_SECRET = "test-secret-0123456789abcdefghijklmnop";

// The real cost (N=2^15) makes every login take ~100 ms; tests don't need that.
const FAST = { N: 1024, r: 8, p: 1 } as const;

let hash: Promise<string> | null = null;

/**
 * An admin account with a cheap password hash, shared by all tests.
 * @param overrides - Fields to change, e.g. a different password hash.
 * @returns The auth config for `createApp`.
 */
export async function testAuth(
	overrides: Partial<AuthConfig> = {},
): Promise<AuthConfig> {
	hash ??= hashPassword(TEST_PASSWORD, FAST);
	return {
		username: TEST_USER,
		passwordHash: await hash,
		secret: TEST_SECRET,
		...overrides,
	};
}

/**
 * Hashes a password with the cheap test settings.
 * @param password - The password.
 * @returns The scrypt hash string.
 */
export function fastHash(password: string): Promise<string> {
	return hashPassword(password, FAST);
}

/**
 * Logs in through `POST /api/auth/login` and returns the session cookie.
 * @param app - The app.
 * @param password - Defaults to the test password.
 * @returns The `glaze_session=…` pair for a `Cookie` header, and the response.
 */
export async function logIn(
	app: Hono,
	password = TEST_PASSWORD,
): Promise<{ cookie: string | null; response: Response }> {
	const response = await app.request("/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username: TEST_USER, password }),
	});
	const header = response.headers.get("set-cookie");
	return { cookie: header ? (header.split(";")[0] ?? null) : null, response };
}

/** An app with a logged-in session; `request` sends the session cookie. */
export interface TestApp {
	readonly app: Hono;
	readonly cookie: string;
	request(path: string, init?: RequestInit): Promise<Response>;
}

/**
 * Creates the app with the test account and logs in, so existing API tests
 * run exactly as before, but behind authentication.
 * @param options - App options; `auth` defaults to `testAuth()`.
 * @returns The app, its cookie and a `request` that sends it.
 */
export async function testApp(
	options: Omit<AppOptions, "auth"> & { auth?: AuthConfig },
): Promise<TestApp> {
	const app = createApp({
		...options,
		auth: options.auth ?? (await testAuth()),
	});
	const { cookie } = await logIn(app);
	if (cookie === null) throw new Error("Test login failed");
	return {
		app,
		cookie,
		request: async (path, init = {}) => {
			const headers = new Headers(init.headers);
			headers.set("Cookie", cookie);
			return await app.request(path, { ...init, headers });
		},
	};
}
