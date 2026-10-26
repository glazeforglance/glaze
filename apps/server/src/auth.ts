import { createHash, timingSafeEqual } from "node:crypto";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { parsePasswordHash, verifyPassword } from "./password.ts";
import { createRateLimiter, type RateLimiter } from "./rate-limit.ts";
import {
	createSessionToken,
	passwordTag,
	readSessionToken,
	SESSION_LIFETIME_MS,
	SESSION_RENEW_BELOW_MS,
} from "./session.ts";

/** The single admin account and the key that signs its sessions. */
export interface AuthConfig {
	readonly username: string;
	/** `scrypt:N:r:p:salt:hash` (or the v0.1.0 `$` format), from `GLAZE_ADMIN_PASSWORD_HASH` (or derived from the plain password). */
	readonly passwordHash: string;
	/** Signs session cookies; from `GLAZE_SECRET` or `.glaze/secret`. */
	readonly secret: string;
}

/** What `installAuth` needs. */
export interface AuthOptions {
	/** `null` turns auth off (`GLAZE_AUTH=off`, development only). */
	readonly auth: AuthConfig | null;
	/** Trust `X-Forwarded-*` / `CF-Connecting-IP` (`GLAZE_TRUST_PROXY`). */
	readonly trustProxy: boolean;
	/** Clock, replaceable in tests. */
	readonly now?: () => number;
	/** Login limiter, replaceable in tests; defaults to 5 failures per 5 minutes. */
	readonly loginLimiter?: RateLimiter;
}

/** Name of the session cookie. */
export const SESSION_COOKIE = "glaze_session";

/** Routes under `/api` that work without a session. */
const PUBLIC_PATHS = new Set([
	"/api/healthz",
	"/api/auth/login",
	"/api/auth/logout",
	"/api/auth/session",
]);

// Passwords this long are a mistake or an attack; refuse them before hashing.
const MAX_CREDENTIAL_LENGTH = 1024;

function firstHeaderValue(value: string | undefined): string | null {
	const first = value?.split(",")[0]?.trim();
	return first ? first : null;
}

/**
 * Tells whether the request reached Glaze over HTTPS, directly or (with
 * `trustProxy`) through a proxy that sets `X-Forwarded-Proto`.
 * @param c - The request context.
 * @param trustProxy - Whether proxy headers may be believed.
 * @returns True for HTTPS.
 */
export function isHttps(c: Context, trustProxy: boolean): boolean {
	if (new URL(c.req.url).protocol === "https:") return true;
	return (
		trustProxy &&
		firstHeaderValue(c.req.header("x-forwarded-proto"))?.toLowerCase() ===
			"https"
	);
}

/**
 * Finds the client's IP address for rate limiting. Behind a trusted proxy
 * that's `CF-Connecting-IP` (Cloudflare) or the **last** `X-Forwarded-For`
 * entry: the one our own proxy added. Earlier entries come from the client
 * and could be made up to dodge the limit.
 * @param c - The request context.
 * @param trustProxy - Whether proxy headers may be believed.
 * @returns The IP address, or `"unknown"` (e.g. in tests without a socket).
 */
export function clientIp(c: Context, trustProxy: boolean): string {
	if (trustProxy) {
		const cloudflare = c.req.header("cf-connecting-ip")?.trim();
		if (cloudflare) return cloudflare;
		const forwarded = c.req
			.header("x-forwarded-for")
			?.split(",")
			.map((part) => part.trim())
			.filter(Boolean)
			.at(-1);
		if (forwarded) return forwarded;
	}
	try {
		return getConnInfo(c).remote.address ?? "unknown";
	} catch {
		// `app.request()` in tests has no Node socket.
		return "unknown";
	}
}

/** Compares two strings in constant time (hashing first makes the lengths equal). */
function safeEqual(a: string, b: string): boolean {
	const digest = (value: string) =>
		createHash("sha256").update(value, "utf8").digest();
	return timingSafeEqual(digest(a), digest(b));
}

function stringField(body: unknown, key: string): string | null {
	if (typeof body !== "object" || body === null) return null;
	const value = (body as Record<string, unknown>)[key];
	return typeof value === "string" && value.length <= MAX_CREDENTIAL_LENGTH
		? value
		: null;
}

/**
 * Adds login, logout and session routes to the app and protects every other
 * `/api/*` route with the session cookie. Call it before adding other routes,
 * so the middleware runs first.
 *
 * - `POST /api/auth/login` `{ username, password }` → `{ authenticated, user }` + cookie;
 *   401 for a wrong user or password (same answer for both), 429 + `Retry-After`
 *   after 5 failures per IP in 5 minutes
 * - `POST /api/auth/logout` → clears the cookie
 * - `GET /api/auth/session` → `{ authenticated, user, authDisabled }`
 * @param app - The Hono app.
 * @param options - Account, proxy trust, clock and limiter.
 * @throws When `auth.passwordHash` isn't a valid hash (checked at startup).
 */
export function installAuth(app: Hono, options: AuthOptions): void {
	const { auth, trustProxy } = options;
	const now = options.now ?? Date.now;

	if (auth === null) {
		const disabled = { authenticated: true, user: null, authDisabled: true };
		app.get("/api/auth/session", (c) => c.json(disabled));
		app.post("/api/auth/login", (c) => c.json(disabled));
		app.post("/api/auth/logout", (c) => c.json({ authenticated: false }));
		return;
	}

	const stored = parsePasswordHash(auth.passwordHash);
	if (!stored.ok) {
		// The env is validated at startup; reaching this is a programmer error.
		throw new Error(`Invalid password hash: ${stored.error}`);
	}
	const tag = passwordTag(auth.secret, auth.passwordHash);
	const limiter =
		options.loginLimiter ??
		createRateLimiter({ max: 5, windowMs: 5 * 60 * 1000, now });

	const cookieOptions = (c: Context) =>
		({
			httpOnly: true,
			sameSite: "Strict",
			path: "/",
			secure: isHttps(c, trustProxy),
		}) as const;

	const issueSession = (c: Context) => {
		const exp = now() + SESSION_LIFETIME_MS;
		const token = createSessionToken(
			{ user: auth.username, exp, pwdTag: tag },
			auth.secret,
		);
		setCookie(c, SESSION_COOKIE, token, {
			...cookieOptions(c),
			maxAge: Math.floor(SESSION_LIFETIME_MS / 1000),
		});
	};

	/** The session's expiry when the cookie is valid for the current account and password. */
	const validSession = (c: Context): number | null => {
		const token = getCookie(c, SESSION_COOKIE);
		if (!token) return null;
		const session = readSessionToken(token, auth.secret, now());
		if (!session.ok) return null;
		const { user, pwdTag, exp } = session.value;
		return safeEqual(user, auth.username) && safeEqual(pwdTag, tag)
			? exp
			: null;
	};

	app.use("/api/*", async (c, next) => {
		if (PUBLIC_PATHS.has(c.req.path)) return next();
		const exp = validSession(c);
		if (exp === null) {
			return c.json(
				{ error: "unauthorized", message: "Log in to use Glaze" },
				401,
			);
		}
		// Sliding renewal: active users stay logged in, idle sessions still expire.
		if (exp - now() < SESSION_RENEW_BELOW_MS) issueSession(c);
		return next();
	});

	app.post("/api/auth/login", async (c) => {
		const ip = clientIp(c, trustProxy);
		const allowed = limiter.check(ip);
		if (!allowed.allowed) {
			c.header("Retry-After", String(allowed.retryAfterSeconds));
			return c.json(
				{
					error: "rate-limited",
					message: "Too many failed logins. Try again later.",
					retryAfter: allowed.retryAfterSeconds,
				},
				429,
			);
		}
		const body: unknown = await c.req.json().catch(() => null);
		const username = stringField(body, "username");
		const password = stringField(body, "password");
		if (username === null || password === null) {
			return c.json(
				{
					error: "bad-request",
					message: "Expected JSON { username: string, password: string }",
				},
				400,
			);
		}
		// Always run scrypt, also for a wrong username, so timing doesn't reveal which was wrong.
		const passwordOk = await verifyPassword(password, stored.value);
		const userOk = safeEqual(username, auth.username);
		if (!passwordOk || !userOk) {
			limiter.fail(ip);
			return c.json(
				{ error: "invalid-credentials", message: "Wrong username or password" },
				401,
			);
		}
		limiter.reset(ip);
		issueSession(c);
		return c.json({ authenticated: true, user: auth.username });
	});

	app.post("/api/auth/logout", (c) => {
		deleteCookie(c, SESSION_COOKIE, cookieOptions(c));
		return c.json({ authenticated: false });
	});

	app.get("/api/auth/session", (c) => {
		const authenticated = validSession(c) !== null;
		return c.json({
			authenticated,
			user: authenticated ? auth.username : null,
			authDisabled: false,
		});
	});
}
