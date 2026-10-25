import { err, ok, type Result } from "@glaze/core";

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

function isConfigResponse(value: unknown): value is ConfigResponse {
	return (
		typeof value === "object" &&
		value !== null &&
		"text" in value &&
		typeof value.text === "string" &&
		"version" in value &&
		typeof value.version === "string"
	);
}

function messageOf(body: unknown, fallback: string): string {
	if (typeof body === "object" && body !== null && "message" in body) {
		return String(body.message);
	}
	return fallback;
}

/**
 * Loads `glance.yml` from the Glaze API.
 * @param signal - Aborts the request (e.g. when the component unmounts).
 * @returns The text and version, or why loading failed.
 */
export async function fetchConfig(
	signal?: AbortSignal,
): Promise<Result<ConfigResponse, ApiError>> {
	let response: Response;
	try {
		response = await fetch("/api/config", { signal: signal ?? null });
	} catch {
		return err({
			status: null,
			message: "Can't reach the Glaze API. Is the server running?",
		});
	}
	const body: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		return err({
			status: response.status,
			message: messageOf(body, `The API answered ${response.status}`),
		});
	}
	if (!isConfigResponse(body)) {
		return err({
			status: response.status,
			message: "The API sent an unexpected response",
		});
	}
	return ok(body);
}

/** A Glance layout rule the server reported as broken. */
export interface PublishIssue {
	readonly code: string;
	readonly message: string;
}

/** Why publishing failed. */
export type PublishError =
	/** The file changed on disk since it was loaded; `version` is what is there now. */
	| { readonly kind: "conflict"; readonly version: string | null }
	/** The server refused the text: invalid YAML (with `line`) or broken layout rules. */
	| {
			readonly kind: "invalid";
			readonly message: string;
			readonly line: number | null;
			readonly issues: readonly PublishIssue[];
	  }
	/** The server couldn't be reached or failed. */
	| { readonly kind: "network" | "server"; readonly message: string };

function field(body: unknown, key: string): unknown {
	return typeof body === "object" && body !== null && key in body
		? (body as Record<string, unknown>)[key]
		: undefined;
}

function issuesOf(body: unknown): PublishIssue[] {
	const issues = field(body, "issues");
	if (!Array.isArray(issues)) return [];
	return issues.map((issue: unknown) => ({
		code: String(field(issue, "code") ?? "invalid"),
		message: String(field(issue, "message") ?? "Invalid layout"),
	}));
}

/**
 * Writes the config through the Glaze API.
 * @param text - The full new `glance.yml`.
 * @param baseVersion - Version the edits were based on; the server refuses
 *   the write (conflict) when the file on disk has a different version.
 * @returns The new version, or why publishing failed.
 */
export async function putConfig(
	text: string,
	baseVersion: string,
): Promise<Result<{ version: string }, PublishError>> {
	let response: Response;
	try {
		response = await fetch("/api/config", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text, baseVersion }),
		});
	} catch {
		return err({
			kind: "network",
			message: "Can't reach the Glaze API. Your changes are still here.",
		});
	}
	const body: unknown = await response.json().catch(() => null);
	const version = field(body, "version");
	if (response.ok && typeof version === "string") return ok({ version });
	if (response.status === 409) {
		return err({
			kind: "conflict",
			version: typeof version === "string" ? version : null,
		});
	}
	if (response.status === 422) {
		const line = field(body, "line");
		return err({
			kind: "invalid",
			message: messageOf(body, "The config is not valid"),
			line: typeof line === "number" ? line : null,
			issues: issuesOf(body),
		});
	}
	return err({
		kind: "server",
		message: messageOf(body, `The API answered ${response.status}`),
	});
}
