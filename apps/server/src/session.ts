import { createHmac, timingSafeEqual } from "node:crypto";
import { err, ok, type Result } from "@glaze/core";

/** What a session cookie says about its holder. */
export interface SessionPayload {
	readonly user: string;
	/** Expiry, in milliseconds since the epoch. */
	readonly exp: number;
	/** `passwordTag` of the password the session was created with. */
	readonly pwdTag: string;
}

/** Why a session token was refused. */
export type SessionError = "malformed" | "bad-signature" | "expired";

/** Sessions last 14 days, like Glance's own. */
export const SESSION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;
/** A session with less than this left gets a fresh cookie. */
export const SESSION_RENEW_BELOW_MS = 7 * 24 * 60 * 60 * 1000;

function sign(data: string, secret: string): Buffer {
	return createHmac("sha256", secret).update(data, "utf8").digest();
}

/**
 * A short tag of the configured password. Changing the password changes the
 * tag, so every existing session stops being valid. Keyed with the secret, so
 * the tag (readable in the cookie) says nothing about the password itself.
 * @param secret - The session secret.
 * @param credential - The password hash (or plain password) from the settings.
 * @returns 16 hex characters.
 */
export function passwordTag(secret: string, credential: string): string {
	return createHmac("sha256", secret)
		.update(`password-tag:${credential}`, "utf8")
		.digest("hex")
		.slice(0, 16);
}

/**
 * Creates a signed session token: `base64url(JSON payload) "." base64url(HMAC-SHA256)`.
 * Stateless, so sessions survive restarts as long as the secret stays the same.
 * @param payload - Who the session is for and until when.
 * @param secret - The session secret.
 * @returns The token for the cookie.
 */
export function createSessionToken(
	payload: SessionPayload,
	secret: string,
): string {
	const data = Buffer.from(JSON.stringify(payload), "utf8").toString(
		"base64url",
	);
	return `${data}.${sign(data, secret).toString("base64url")}`;
}

function isPayload(value: unknown): value is SessionPayload {
	if (typeof value !== "object" || value === null) return false;
	const { user, exp, pwdTag } = value as Record<string, unknown>;
	return (
		typeof user === "string" &&
		typeof exp === "number" &&
		Number.isFinite(exp) &&
		typeof pwdTag === "string"
	);
}

/**
 * Checks a session token's signature and expiry. The signature is checked
 * first, in constant time, so nothing in an unsigned payload is ever trusted.
 * @param token - The cookie value.
 * @param secret - The session secret.
 * @param now - Current time in milliseconds.
 * @returns The payload, or why the token was refused.
 */
export function readSessionToken(
	token: string,
	secret: string,
	now: number,
): Result<SessionPayload, SessionError> {
	const [data, signature, ...rest] = token.split(".");
	if (!data || !signature || rest.length > 0) return err("malformed");
	const expected = sign(data, secret);
	const given = Buffer.from(signature, "base64url");
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
		return err("bad-signature");
	}
	let payload: unknown;
	try {
		payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
	} catch {
		return err("malformed");
	}
	if (!isPayload(payload)) return err("malformed");
	if (payload.exp <= now) return err("expired");
	return ok(payload);
}
