import { isNode } from "yaml";
import type { GlazeDocument } from "./document.ts";
import type { Problem, ServerOptionProblemCode, YamlPath } from "./types.ts";

/*
 * Rules for glance.yml's `server` section. Glance v0.8.7 listens on
 * `fmt.Sprintf("%s:%d", host, port)` (glance.go) and never checks `host`
 * itself, so `glance config:validate` accepts values that make Glance fail
 * to start ("too many colons in address"). These checks catch that first.
 */

/** Glance's default `server.port` (config.go). */
export const DEFAULT_GLANCE_PORT = 8080;

/** The `server` options Glaze checks. */
export type ServerOptionKey = "host" | "port" | "base-url";

/** The options that decide where Glance listens. */
export type ListenOptionKey = "host" | "port";

/** A broken `server` option. */
export interface ServerOptionIssue extends Problem<ServerOptionProblemCode> {
	readonly key: ServerOptionKey;
	readonly path: YamlPath;
}

/** A broken `server` option, before it is tied to a key. */
export type ServerOptionProblem = Problem<ServerOptionProblemCode>;

function problem(
	code: ServerOptionProblemCode,
	message: string,
	params?: ServerOptionProblem["params"],
): ServerOptionProblem {
	return params ? { code, params, message } : { code, message };
}

const HOST_IS_URL = (): ServerOptionProblem =>
	problem("host-is-url", HOST_NOT_A_URL);

/** Shown when `host` looks like "where I reach Glance" instead of a listen address. */
export const HOST_NOT_A_URL =
	"Host is the address Glance listens on, not a URL. Leave it empty to listen everywhere.";

/** Shown (and confirmed) when host or port changes while Glance runs in a container. */
export const CONTAINER_LISTEN_WARNING =
	"Glance runs in a container. This is the port inside the container. Your Docker port mapping still sends traffic to the old port, so Glance will be unreachable. Change the port mapping instead.";

const KEYS: readonly ServerOptionKey[] = ["host", "port", "base-url"];

const HOSTNAME_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const IPV4_LIKE = /^\d+(?:\.\d+){3}$/;
// Core runs without DOM or Node types, so URLs are read with a pattern instead of `URL`.
const HTTP_URL =
	/^(https?):\/\/(?:[^@/?#\s]*@)?(\[[0-9A-Fa-f:.]+\]|[^/?#:\s]+)(?::(\d{1,5}))?(?:[/?#]\S*)?$/i;

function isIPv4(text: string): boolean {
	return (
		IPV4_LIKE.test(text) &&
		text.split(".").every((part) => Number(part) <= 255 && part.length <= 3)
	);
}

/**
 * Tells whether a text is an IPv6 address (without brackets or zone).
 * @param text - The candidate, e.g. `::1` or `fe80::2:3`.
 * @returns True for a valid address.
 */
export function isIPv6(text: string): boolean {
	const halves = text.split("::");
	if (halves.length > 2) return false;
	const groups = (half: string) => (half === "" ? [] : half.split(":"));
	const head = groups(halves[0] ?? "");
	const tail = halves.length === 2 ? groups(halves[1] ?? "") : [];
	const all = [...head, ...tail];
	// A trailing IPv4 part (`::ffff:1.2.3.4`) counts as two groups.
	const last = all.at(-1);
	const ipv4Tail = last !== undefined && last.includes(".");
	if (ipv4Tail && !isIPv4(last)) return false;
	const hexGroups = ipv4Tail ? all.slice(0, -1) : all;
	if (!hexGroups.every((group) => /^[0-9A-Fa-f]{1,4}$/.test(group))) {
		return false;
	}
	const count = hexGroups.length + (ipv4Tail ? 2 : 0);
	return halves.length === 2 ? count < 8 : count === 8;
}

function isHostname(text: string): boolean {
	if (text.length > 253) return false;
	const labels = text.replace(/\.$/, "").split(".");
	// All-numeric dotted text that isn't a valid IPv4 address is a typo, not a name.
	if (labels.every((label) => /^\d+$/.test(label))) return false;
	return labels.every((label) => HOSTNAME_LABEL.test(label));
}

function hostProblem(host: string): ServerOptionProblem | null {
	if (host === "") return null;
	if (host.includes("://") || host.includes("/")) return HOST_IS_URL();
	if (host.startsWith("[")) {
		const close = host.indexOf("]");
		if (close === -1) {
			return problem(
				"host-unclosed-bracket",
				"Host has a [ without a closing ].",
			);
		}
		if (close !== host.length - 1) return HOST_IS_URL();
		return isIPv6(host.slice(1, close))
			? null
			: problem(
					"host-bad-ipv6",
					"Host has brackets, but no valid IPv6 address inside them.",
				);
	}
	if (isIPv6(host)) {
		// Glance appends ":port", so a bare IPv6 address breaks its listen address.
		return problem(
			"host-ipv6-needs-brackets",
			`Write an IPv6 address in brackets, e.g. [${host}]. Glance adds the port after it.`,
			{ host },
		);
	}
	if (host.includes(":")) return HOST_IS_URL();
	if (isIPv4(host) || isHostname(host)) return null;
	return problem(
		"host-invalid",
		"Host must be an IP address or a host name. Leave it empty to listen everywhere.",
	);
}

function portProblem(port: unknown): ServerOptionProblem | null {
	return typeof port === "number" &&
		Number.isInteger(port) &&
		port >= 1 &&
		port <= 65535
		? null
		: problem("port-invalid", "Port must be a whole number from 1 to 65535.");
}

function baseUrlProblem(value: unknown): ServerOptionProblem | null {
	const message = problem(
		"base-url-invalid",
		"Base URL must start with / (e.g. /glance) or be a full http(s) URL.",
	);
	if (typeof value !== "string") return message;
	if (value === "" || value.startsWith("/")) return null;
	// Glance only puts base-url in front of its own paths, so a full URL works too.
	return HTTP_URL.test(value) ? null : message;
}

/**
 * Checks one `server` option the way Glance will use it. Values with a
 * `${…}` placeholder are skipped: their real value is only known where
 * Glance runs. Missing values (`undefined`/`null`) use Glance's default.
 * @param key - `host`, `port` or `base-url`.
 * @param value - The option's value from the YAML.
 * @returns The problem (code, values, English message), or `null` when the value is fine.
 */
export function serverOptionProblem(
	key: ServerOptionKey,
	value: unknown,
): ServerOptionProblem | null {
	if (value === undefined || value === null) return null;
	if (typeof value === "string" && value.includes("${")) return null;
	switch (key) {
		case "host":
			return typeof value === "string" || typeof value === "number"
				? hostProblem(String(value).trim())
				: problem("host-not-text", "Host must be text.");
		case "port":
			return portProblem(value);
		case "base-url":
			return baseUrlProblem(value);
	}
}

function serverValue(doc: GlazeDocument, key: string): unknown {
	return doc.yaml.getIn(["server", key]);
}

/**
 * Checks `server.host`, `server.port` and `server.base-url` of a config.
 * @param doc - The document to check.
 * @returns One issue per broken option; empty when all are fine.
 */
export function validateServerOptions(doc: GlazeDocument): ServerOptionIssue[] {
	const issues: ServerOptionIssue[] = [];
	for (const key of KEYS) {
		const found = serverOptionProblem(key, serverValue(doc, key));
		if (found !== null) issues.push({ key, path: ["server", key], ...found });
	}
	return issues;
}

function listenValue(doc: GlazeDocument, key: ListenOptionKey): string {
	const value = serverValue(doc, key);
	if (value === undefined || value === null) {
		return key === "port" ? String(DEFAULT_GLANCE_PORT) : "";
	}
	return String(value).trim();
}

/**
 * Lists which listen options differ between two versions of a config,
 * counting a missing option as Glance's default (empty host, port 8080).
 * @param before - The published config.
 * @param after - The draft.
 * @returns `host` and/or `port`, in that order; empty when neither changed.
 */
export function changedListenOptions(
	before: GlazeDocument,
	after: GlazeDocument,
): ListenOptionKey[] {
	return (["host", "port"] as const).filter(
		(key) => listenValue(before, key) !== listenValue(after, key),
	);
}

function serverJson(doc: GlazeDocument): string {
	const value: unknown = doc.yaml.get("server", true);
	// Only compared, never written back, so a plain-JS copy is fine here.
	return JSON.stringify(isNode(value) ? value.toJSON() : (value ?? null));
}

/**
 * Tells whether anything in the `server` section differs between two
 * versions of a config (values only; comments and formatting don't count).
 * @param before - The previous config.
 * @param after - The new config.
 * @returns True when a `server` option was added, changed or removed.
 */
export function serverSectionChanged(
	before: GlazeDocument,
	after: GlazeDocument,
): boolean {
	return serverJson(before) !== serverJson(after);
}

/** What `glanceRunsInContainer` looks at. */
export interface ContainerHints {
	/** Glaze itself runs in a container (then Glance almost surely does too). */
	readonly glazeInContainer: boolean;
	/** `GLANCE_URL`, or `null` when it isn't set. */
	readonly glanceUrl: string | null;
	/** `server.port` of the published config (missing: Glance's default). */
	readonly port: unknown;
}

/**
 * Guesses whether Glance runs behind a port mapping (Docker or similar):
 * Glaze runs in a container, or `GLANCE_URL` reaches Glance on another port
 * than the one it listens on.
 * @param hints - What Glaze knows about its environment.
 * @returns True when changing host or port likely makes Glance unreachable.
 */
export function glanceRunsInContainer(hints: ContainerHints): boolean {
	if (hints.glazeInContainer) return true;
	const url = hints.glanceUrl === null ? null : HTTP_URL.exec(hints.glanceUrl);
	if (url === null) return false;
	const port =
		hints.port === undefined || hints.port === null
			? DEFAULT_GLANCE_PORT
			: hints.port;
	if (typeof port !== "number") return false;
	const scheme = url[1]?.toLowerCase();
	const urlPort = url[3] ? Number(url[3]) : scheme === "https" ? 443 : 80;
	return urlPort !== port;
}
