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
