/*
 * Pure rules for the Settings view: Glance's login (secret key, users,
 * password hashes) and how server options relate to the way Glaze reaches
 * Glance (GLANCE_URL).
 */

/** Glance's secret key: 32 + 32 random bytes (auth.go, `AUTH_SECRET_KEY_LENGTH`). */
export const SECRET_KEY_BYTES = 64;

/** Glance refuses shorter user names (config.go). */
export const MIN_USERNAME_LENGTH = 3;

/**
 * Makes a secret key the way `glance secret:make` does: 64 random bytes,
 * standard base64 (88 characters).
 * @param random - Fills a byte array with random values; the browser's crypto by default.
 * @returns The key.
 */
export function makeSecretKey(
	random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (bytes) =>
		crypto.getRandomValues(bytes),
): string {
	const bytes = random(new Uint8Array(SECRET_KEY_BYTES));
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/**
 * Shows a secret or password hash without giving it away: the start, then
 * an ellipsis. Glance's hashes start with `$2a$10$`, which says enough.
 * @param value - A hash or key.
 * @returns E.g. `$2a$10$Fq3…` (12 characters at most), or `""` when empty.
 */
export function maskSecret(value: string): string {
	if (value === "") return "";
	return value.length <= 11
		? "•".repeat(value.length)
		: `${value.slice(0, 11)}…`;
}

/**
 * Checks a user name for Glance's `auth.users` before it's written.
 * @param name - The name the user typed.
 * @param existing - Names that are already taken.
 * @returns A message, or `null` when the name is fine.
 */
export function usernameProblem(
	name: string,
	existing: readonly string[],
): string | null {
	const trimmed = name.trim();
	if (trimmed.length < MIN_USERNAME_LENGTH) {
		return `Glance needs a user name of at least ${MIN_USERNAME_LENGTH} characters.`;
	}
	if (existing.includes(trimmed))
		return `There already is a user "${trimmed}".`;
	if (trimmed.includes(".") || /^\d+$/.test(trimmed)) {
		return "Names with dots or only digits can be added in the Code view.";
	}
	return null;
}

/** The `server` options that decide where Glance listens. */
export interface ServerOptions {
	readonly host?: unknown;
	readonly port?: unknown;
	readonly "base-url"?: unknown;
}

const DEFAULT_PORT = 8080;

/**
 * Explains how the server options relate to the address Glaze uses for the
 * live preview (`GLANCE_URL`). Behind a proxy or in Docker the two can
 * rightly differ, so these are hints, not errors.
 * @param glanceUrl - `GLANCE_URL` from the server, or `null` when it isn't set.
 * @param server - The `server` section's values.
 * @returns Sentences to show; empty when nothing stands out.
 */
export function glanceReachNotes(
	glanceUrl: string | null,
	server: ServerOptions,
): string[] {
	if (glanceUrl === null) {
		return [
			"GLANCE_URL isn't set, so Glaze shows no live preview; these options don't affect Glaze.",
		];
	}
	let url: URL;
	try {
		url = new URL(glanceUrl);
	} catch {
		return [];
	}
	const notes: string[] = [];
	const port =
		typeof server.port === "number"
			? server.port
			: Number.parseInt(String(server.port ?? ""), 10) || DEFAULT_PORT;
	const urlPort = Number(url.port || (url.protocol === "https:" ? 443 : 80));
	const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
	if (local && urlPort !== port) {
		notes.push(
			`Glaze opens Glance at ${glanceUrl}, but Glance would listen on port ${port}: update GLANCE_URL when you publish this.`,
		);
	}
	const base =
		typeof server["base-url"] === "string"
			? server["base-url"].replace(/\/+$/, "")
			: "";
	const path = url.pathname.replace(/\/+$/, "");
	if (base !== "" && !path.endsWith(base)) {
		notes.push(
			`With a base URL of ${base}, Glance's pages move under that path; GLANCE_URL (${glanceUrl}) may need it too.`,
		);
	}
	return notes;
}
