import {
	err,
	type IssueSeverity,
	type IssueSource,
	ok,
	type Result,
	type ValidationIssue,
	type YamlPath,
} from "@glaze/core";

/** The config as `GET /api/config` returns it. */
export interface ConfigResponse {
	readonly text: string;
	readonly version: string;
}

/** Why an API call failed. */
export interface ApiError {
	/** HTTP status, or `null` when the server couldn't be reached. */
	readonly status: number | null;
	readonly message: string;
}

const UNREACHABLE = "Can't reach the Glaze API. Is the server running?";

function field(body: unknown, key: string): unknown {
	return typeof body === "object" && body !== null && key in body
		? (body as Record<string, unknown>)[key]
		: undefined;
}

function messageOf(body: unknown, fallback: string): string {
	const message = field(body, "message");
	return message === undefined ? fallback : String(message);
}

/** Waits until the user has logged in again; set by the auth store. */
type UnauthorizedHandler = () => Promise<void>;

let onUnauthorized: UnauthorizedHandler | null = null;

/**
 * Sets what happens when the API answers 401 (the session expired or was
 * ended): the handler shows the login overlay and resolves once the user is
 * logged in again. The request is then sent again, so the original action
 * (a publish, a validation) finishes and nothing in the editor is lost.
 * @param handler - The handler, or `null` to remove it.
 */
export function setUnauthorizedHandler(
	handler: UnauthorizedHandler | null,
): void {
	onUnauthorized = handler;
}

/**
 * `fetch`, but a 401 waits for a new login and then retries. Bodies are
 * always strings here, so sending the same `init` twice is safe.
 * Throws like `fetch` (network errors, aborts).
 */
async function send(url: string, init: RequestInit = {}): Promise<Response> {
	const response = await fetch(url, init);
	if (response.status !== 401 || onUnauthorized === null) return response;
	await onUnauthorized();
	return send(url, init);
}

/** Fetches JSON; turns network failures and non-2xx answers into an `ApiError`. */
async function requestJson(
	url: string,
	init: RequestInit = {},
): Promise<Result<unknown, ApiError>> {
	let response: Response;
	try {
		response = await send(url, init);
	} catch (error) {
		// An abort is the caller's own doing; report it as such so it can be ignored.
		const aborted =
			error instanceof DOMException && error.name === "AbortError";
		return err({ status: null, message: aborted ? "Aborted" : UNREACHABLE });
	}
	const body: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		return err({
			status: response.status,
			message: messageOf(body, `The API answered ${response.status}`),
		});
	}
	return ok(body);
}

function jsonInit(method: string, body: unknown, signal?: AbortSignal) {
	return {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		signal: signal ?? null,
	};
}

const BAD_RESPONSE: ApiError = {
	status: null,
	message: "The API sent an unexpected response",
};

/**
 * Loads `glance.yml` from the Glaze API.
 * @param signal - Aborts the request (e.g. when the component unmounts).
 * @returns The text and version, or why loading failed.
 */
export async function fetchConfig(
	signal?: AbortSignal,
): Promise<Result<ConfigResponse, ApiError>> {
	const result = await requestJson("/api/config", { signal: signal ?? null });
	if (!result.ok) return result;
	const text = field(result.value, "text");
	const version = field(result.value, "version");
	if (typeof text !== "string" || typeof version !== "string") {
		return err(BAD_RESPONSE);
	}
	return ok({ text, version });
}

const SEVERITIES: readonly IssueSeverity[] = ["error", "warning", "info"];
const SOURCES: readonly IssueSource[] = ["yaml", "layout", "glance", "glaze"];

function isPath(value: unknown): value is YamlPath {
	return (
		Array.isArray(value) &&
		value.every((part) => typeof part === "string" || typeof part === "number")
	);
}

function toIssue(value: unknown): ValidationIssue | null {
	const severity = field(value, "severity");
	const source = field(value, "source");
	const message = field(value, "message");
	if (
		!SEVERITIES.includes(severity as IssueSeverity) ||
		!SOURCES.includes(source as IssueSource) ||
		typeof message !== "string"
	) {
		return null;
	}
	const line = field(value, "line");
	const column = field(value, "column");
	const path = field(value, "path");
	const fix = field(value, "fix");
	const fixPath = field(fix, "mapPath");
	const from = field(fix, "from");
	const to = field(fix, "to");
	const docsUrl = field(value, "docsUrl");
	return {
		severity: severity as IssueSeverity,
		source: source as IssueSource,
		message,
		...(typeof line === "number" ? { line } : {}),
		...(typeof column === "number" ? { column } : {}),
		...(isPath(path) ? { path } : {}),
		...(field(fix, "kind") === "rename-key" &&
		isPath(fixPath) &&
		typeof from === "string" &&
		typeof to === "string"
			? { fix: { kind: "rename-key" as const, mapPath: fixPath, from, to } }
			: {}),
		...(field(value, "requiresConfirmation") === true
			? { requiresConfirmation: true }
			: {}),
		// Rendered as a link, so only https URLs are kept.
		...(typeof docsUrl === "string" && docsUrl.startsWith("https://")
			? { docsUrl }
			: {}),
	};
}

/**
 * Reads the `issues` array of an API answer, dropping anything malformed.
 * @param body - The parsed JSON body.
 * @returns The issues.
 */
export function issuesOf(body: unknown): ValidationIssue[] {
	const issues = field(body, "issues");
	if (!Array.isArray(issues)) return [];
	return issues
		.map(toIssue)
		.filter((issue): issue is ValidationIssue => issue !== null);
}

/**
 * Validates a draft config (YAML, layout rules, unknown options and, when the
 * server has `GLANCE_BIN`, Glance itself).
 * @param text - The draft text.
 * @param signal - Cancels the request when a newer draft comes in.
 * @returns The issues, or why validation couldn't run.
 */
export async function validateConfig(
	text: string,
	signal?: AbortSignal,
): Promise<Result<ValidationIssue[], ApiError>> {
	const result = await requestJson(
		"/api/validate",
		jsonInit("POST", { text }, signal),
	);
	return result.ok ? ok(issuesOf(result.value)) : result;
}

/** Why publishing failed. */
export type PublishError =
	/** The file changed on disk since it was loaded; `version` is what is there now. */
	| { readonly kind: "conflict"; readonly version: string | null }
	/** The server refused the text; `issues` explains why. */
	| {
			readonly kind: "invalid";
			readonly message: string;
			readonly issues: readonly ValidationIssue[];
	  }
	/** The server couldn't be reached or failed. */
	| { readonly kind: "network" | "server"; readonly message: string };

/** A successful write. */
export interface Published {
	readonly version: string;
	/** Warnings (and errors, when forced) that came with the write. */
	readonly issues: readonly ValidationIssue[];
}

/**
 * Writes the config through the Glaze API. The server validates it first.
 * @param text - The full new `glance.yml`.
 * @param baseVersion - Version the edits were based on; the server refuses
 *   the write (conflict) when the file on disk has a different version.
 * @param force - Write even when validation finds errors (never for broken YAML).
 * @param confirmed - The user confirmed the issues that need it (e.g. a port
 *   change behind a Docker port mapping).
 * @returns The new version, or why publishing failed.
 */
export async function putConfig(
	text: string,
	baseVersion: string,
	force = false,
	confirmed = false,
): Promise<Result<Published, PublishError>> {
	let response: Response;
	try {
		response = await send(
			"/api/config",
			jsonInit("PUT", {
				text,
				baseVersion,
				...(force ? { force } : {}),
				...(confirmed ? { confirmed } : {}),
			}),
		);
	} catch {
		return err({
			kind: "network",
			message: "Can't reach the Glaze API. Your changes are still here.",
		});
	}
	const body: unknown = await response.json().catch(() => null);
	const version = field(body, "version");
	if (response.ok && typeof version === "string") {
		return ok({ version, issues: issuesOf(body) });
	}
	if (response.status === 409) {
		return err({
			kind: "conflict",
			version: typeof version === "string" ? version : null,
		});
	}
	if (response.status === 422) {
		return err({
			kind: "invalid",
			message: messageOf(body, "The config is not valid"),
			issues: issuesOf(body),
		});
	}
	return err({
		kind: "server",
		message: messageOf(body, `The API answered ${response.status}`),
	});
}

/** An asset file the config references (`theme.custom-css-file`, `/assets/` links). */
export interface AssetEntry {
	readonly name: string;
	readonly language: "css" | "javascript";
}

/** The list of asset files, plus why some can't be edited (if so). */
export interface AssetList {
	readonly files: readonly AssetEntry[];
	readonly unavailable: string | null;
}

/**
 * Lists the asset files the config on disk references.
 * @returns The files, or why the list couldn't be loaded.
 */
export async function fetchFiles(): Promise<Result<AssetList, ApiError>> {
	const result = await requestJson("/api/files");
	if (!result.ok) return result;
	const files = field(result.value, "files");
	const unavailable = field(result.value, "unavailable");
	if (!Array.isArray(files)) return err(BAD_RESPONSE);
	return ok({
		files: files.flatMap((file: unknown) => {
			const name = field(file, "name");
			const language = field(file, "language");
			return typeof name === "string" &&
				(language === "css" || language === "javascript")
				? [{ name, language }]
				: [];
		}),
		unavailable: typeof unavailable === "string" ? unavailable : null,
	});
}

/** An asset file's contents; `version` is `null` while the file doesn't exist. */
export interface AssetContent {
	readonly text: string;
	readonly version: string | null;
}

function fileUrl(name: string): string {
	// Keep `/` between folders; encode everything inside a segment.
	return `/api/files/${name.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Loads one asset file.
 * @param name - Name from `fetchFiles`, e.g. `custom.css`.
 * @returns The text and version, or why it couldn't be loaded.
 */
export async function fetchFile(
	name: string,
): Promise<Result<AssetContent, ApiError>> {
	const result = await requestJson(fileUrl(name));
	if (!result.ok) return result;
	const text = field(result.value, "text");
	const version = field(result.value, "version");
	if (
		typeof text !== "string" ||
		(typeof version !== "string" && version !== null)
	) {
		return err(BAD_RESPONSE);
	}
	return ok({ text, version });
}

/**
 * Writes one asset file.
 * @param name - Name from `fetchFiles`.
 * @param text - New contents.
 * @param baseVersion - Version it was loaded with (`null` for a new file).
 * @returns The new version, or why it failed (a change on disk included).
 */
export async function putFile(
	name: string,
	text: string,
	baseVersion: string | null,
): Promise<Result<{ version: string }, PublishError>> {
	const result = await requestJson(
		fileUrl(name),
		jsonInit("PUT", { text, baseVersion }),
	);
	if (result.ok) {
		const version = field(result.value, "version");
		return typeof version === "string"
			? ok({ version })
			: err({ kind: "server", message: BAD_RESPONSE.message });
	}
	if (result.error.status === 409) {
		return err({
			kind: "server",
			message: `${name} changed on disk since it was loaded. Reload Glaze to get the new version.`,
		});
	}
	return err({
		kind: result.error.status === null ? "network" : "server",
		message: `${name}: ${result.error.message}`,
	});
}

/** Server settings the browser needs. */
export interface Settings {
	/** Where the preview iframe loads Glance from; `null` when `GLANCE_URL` isn't set. */
	readonly glanceUrl: string | null;
	/** Whether the server runs `glance config:validate`. */
	readonly glanceValidation: boolean;
	/** Glaze runs in a container, so Glance probably sits behind a port mapping. */
	readonly glazeInContainer: boolean;
}

/**
 * Loads the server settings.
 * @returns The settings, or why they couldn't be loaded.
 */
export async function fetchSettings(): Promise<Result<Settings, ApiError>> {
	const result = await requestJson("/api/settings");
	if (!result.ok) return result;
	const glanceUrl = field(result.value, "glanceUrl");
	return ok({
		glanceUrl: typeof glanceUrl === "string" ? glanceUrl : null,
		glanceValidation: field(result.value, "glanceValidation") === true,
		glazeInContainer: field(result.value, "glazeInContainer") === true,
	});
}

/**
 * Hashes a password for Glance's `auth.users` on the server (with Glance's
 * own `password:hash` when available, else bcrypt at Glance's cost). The
 * password goes to Glaze's API only, and is never stored.
 * @param password - The new password.
 * @returns The bcrypt hash, or why it couldn't be made (e.g. too short).
 */
export async function hashGlancePassword(
	password: string,
): Promise<Result<string, ApiError>> {
	const result = await requestJson(
		"/api/glance/password-hash",
		jsonInit("POST", { password }),
	);
	if (!result.ok) return result;
	const hash = field(result.value, "hash");
	return typeof hash === "string" ? ok(hash) : err(BAD_RESPONSE);
}

/** The login state, as `GET /api/auth/session` reports it. */
export interface Session {
	readonly authenticated: boolean;
	readonly user: string | null;
	/** `GLAZE_AUTH=off` on the server (development only). */
	readonly authDisabled: boolean;
}

function sessionOf(body: unknown): Session {
	const user = field(body, "user");
	return {
		authenticated: field(body, "authenticated") === true,
		user: typeof user === "string" ? user : null,
		authDisabled: field(body, "authDisabled") === true,
	};
}

// The auth routes use plain `fetch`: their 401 means "wrong password", not
// "show the login overlay".

/**
 * Asks the server whether this browser has a valid session.
 * @returns The session state, or why the server couldn't be asked.
 */
export async function fetchSession(): Promise<Result<Session, ApiError>> {
	try {
		const response = await fetch("/api/auth/session", { cache: "no-store" });
		const body: unknown = await response.json().catch(() => null);
		if (!response.ok) {
			return err({
				status: response.status,
				message: messageOf(body, `The API answered ${response.status}`),
			});
		}
		return ok(sessionOf(body));
	} catch {
		return err({ status: null, message: UNREACHABLE });
	}
}

/** Why logging in failed. */
export interface LoginError {
	readonly kind: "invalid" | "rate-limited" | "network" | "server";
	readonly message: string;
	/** Seconds to wait, for `rate-limited`. */
	readonly retryAfter?: number;
}

/**
 * Logs in; the server sets the session cookie.
 * @param username - The admin username.
 * @param password - The password.
 * @returns The new session, or why it failed.
 */
export async function login(
	username: string,
	password: string,
): Promise<Result<Session, LoginError>> {
	let response: Response;
	try {
		response = await fetch(
			"/api/auth/login",
			jsonInit("POST", { username, password }),
		);
	} catch {
		return err({ kind: "network", message: UNREACHABLE });
	}
	const body: unknown = await response.json().catch(() => null);
	if (response.ok) return ok(sessionOf(body));
	if (response.status === 401) {
		return err({ kind: "invalid", message: "Wrong username or password." });
	}
	if (response.status === 429) {
		const seconds = Number(response.headers.get("Retry-After"));
		const retryAfter = Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
		const minutes = Math.ceil(retryAfter / 60);
		return err({
			kind: "rate-limited",
			retryAfter,
			message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
		});
	}
	return err({
		kind: "server",
		message: messageOf(body, `The API answered ${response.status}`),
	});
}

/**
 * Ends the session; the server clears the cookie.
 * @returns Nothing, or why the server couldn't be reached.
 */
export async function logout(): Promise<Result<void, ApiError>> {
	try {
		const response = await fetch("/api/auth/logout", jsonInit("POST", {}));
		return response.ok
			? ok(undefined)
			: err({
					status: response.status,
					message: `The API answered ${response.status}`,
				});
	} catch {
		return err({ status: null, message: UNREACHABLE });
	}
}
