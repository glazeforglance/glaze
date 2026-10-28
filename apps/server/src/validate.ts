import {
	CONTAINER_LISTEN_WARNING,
	changedListenOptions,
	findUnknownOptions,
	type GlazeDocument,
	getNodeRange,
	type KnownKeys,
	glanceRunsInContainer,
	parseConfig,
	type ValidationIssue,
	validateLayout,
	validateServerOptions,
	type YamlPath,
} from "@glaze/core";
import { glanceKeys } from "@glaze/schemas";
import { type GlanceCommand, runGlanceValidate } from "./glance-validate.ts";
import { findMissingOptions } from "./required-options.ts";

/**
 * The keys Glance reads (generated from its source, see @glaze/schemas);
 * anything else in a page, column or widget is a warning.
 */
const KNOWN_KEYS: KnownKeys = glanceKeys();

/** What `validateDraft` needs besides the text. */
export interface ValidateOptions {
	/** Path of the real `glance.yml`; Glance's temp file goes next to it. */
	readonly configPath: string;
	/** How to run Glance, or `null` when `GLANCE_BIN` isn't set. */
	readonly glance: GlanceCommand | null;
	/** Environment for Glance; defaults to `process.env`. */
	readonly env?: Readonly<Record<string, string | undefined>>;
	/** `GLAZE_ASSETS_PATH`; Glance checks the assets folder there when it exists. */
	readonly assetsPath?: string | null;
	/** The config on disk, to spot host/port changes; `null` when there is none. */
	readonly publishedText?: string | null;
	/** Glaze runs in a container (`/.dockerenv` or `/run/.containerenv`). */
	readonly glazeInContainer?: boolean;
	/** `GLANCE_URL`, to compare its port with `server.port`. */
	readonly glanceUrl?: string | null;
}

/**
 * Warns when the draft changes `server.host` or `server.port` while Glance
 * likely runs behind a port mapping: the mapping won't follow, so Glance
 * becomes unreachable. Publishing such a change needs a confirmation.
 * @param doc - The draft.
 * @param options - The published config and container hints.
 * @returns The warning, or `null`.
 */
function listenChangeIssue(
	doc: GlazeDocument,
	options: ValidateOptions,
): ValidationIssue | null {
	if (options.publishedText == null) return null;
	const published = parseConfig(options.publishedText);
	if (!published.ok) return null;
	const [changed] = changedListenOptions(published.value, doc);
	if (changed === undefined) return null;
	const inContainer = glanceRunsInContainer({
		glazeInContainer: options.glazeInContainer ?? false,
		glanceUrl: options.glanceUrl ?? null,
		port: published.value.yaml.getIn(["server", "port"]),
	});
	if (!inContainer) return null;
	const path: YamlPath = ["server", changed];
	return {
		severity: "warning",
		source: "glaze",
		message: CONTAINER_LISTEN_WARNING,
		path,
		...at(doc, path),
		requiresConfirmation: true,
	};
}

function at(doc: GlazeDocument, path: YamlPath | undefined) {
	const range = path ? getNodeRange(doc, path) : null;
	return range ? { line: range.startLine } : {};
}

/**
 * Checks a draft config, the same way for the code view and for Publish:
 * 1. YAML syntax (stops here when the YAML is broken);
 * 2. Glance's layout rules and `server` host/port/base-url → errors, plus a
 *    warning that needs confirming when host/port change behind a port mapping;
 * 3. options Glance requires that a widget lacks → errors, in plain words
 *    ("Weather needs a location") instead of Glance's own message;
 * 4. options Glance doesn't know → warnings (Glance ignores them), with a fix
 *    when a known key is close;
 * 5. `glance config:validate`, when `GLANCE_BIN` is set; otherwise one info.
 * @param text - The draft, not the file on disk.
 * @param options - Config path and Glance command.
 * @returns All issues, in that order.
 */
export async function validateDraft(
	text: string,
	options: ValidateOptions,
): Promise<ValidationIssue[]> {
	const parsed = parseConfig(text);
	if (!parsed.ok) {
		const { message, line, column } = parsed.error;
		return [
			{
				severity: "error",
				source: "yaml",
				message,
				...(line !== null ? { line } : {}),
				...(column !== null ? { column } : {}),
			},
		];
	}
	const doc = parsed.value;
	const issues: ValidationIssue[] = [];

	for (const issue of validateLayout(doc)) {
		issues.push({
			severity: "error",
			source: "layout",
			message: issue.message,
			path: issue.path,
			...at(doc, issue.path),
		});
	}

	for (const option of validateServerOptions(doc)) {
		issues.push({
			severity: "error",
			source: "glaze",
			message: option.message,
			path: option.path,
			...at(doc, option.path),
		});
	}
	const listenChange = listenChangeIssue(doc, options);
	if (listenChange !== null) issues.push(listenChange);

	for (const missing of findMissingOptions(doc)) {
		issues.push({
			severity: "error",
			source: "glaze",
			message: missing.message,
			path: missing.path,
			...at(doc, missing.path),
		});
	}

	for (const option of findUnknownOptions(doc, KNOWN_KEYS)) {
		const mapPath = option.path.slice(0, -1);
		issues.push({
			severity: "warning",
			source: "glaze",
			message:
				option.suggestion === null
					? `Unknown option "${option.key}"; Glance ignores it`
					: `Unknown option "${option.key}". Did you mean "${option.suggestion}"?`,
			path: option.path,
			...at(doc, option.path),
			...(option.suggestion === null
				? {}
				: {
						fix: {
							kind: "rename-key" as const,
							mapPath,
							from: option.key,
							to: option.suggestion,
						},
					}),
		});
	}

	if (options.glance === null) {
		issues.push({
			severity: "info",
			source: "glaze",
			message: "Glance validation is off — set GLANCE_BIN",
		});
		return issues;
	}
	const glanceIssues = await runGlanceValidate(
		text,
		options.configPath,
		options.glance,
		options.env,
		options.assetsPath ?? null,
	);
	for (const issue of glanceIssues) {
		// Glance gives "page 2" but no line; the path tells us where that is.
		issues.push(
			issue.line === undefined ? { ...issue, ...at(doc, issue.path) } : issue,
		);
	}
	return issues;
}

/**
 * Tells whether publishing needs an explicit confirmation.
 * @param issues - Issues from `validateDraft`.
 * @returns True when an issue has `requiresConfirmation`.
 */
export function needsConfirmation(issues: readonly ValidationIssue[]): boolean {
	return issues.some((issue) => issue.requiresConfirmation === true);
}

/**
 * Tells whether any issue blocks publishing.
 * @param issues - Issues from `validateDraft`.
 * @returns True when there is at least one error.
 */
export function hasErrors(issues: readonly ValidationIssue[]): boolean {
	return issues.some((issue) => issue.severity === "error");
}
