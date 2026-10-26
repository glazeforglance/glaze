import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	findEnvReferences,
	offsetToLineColumn,
	type ValidationIssue,
	type YamlPath,
} from "@glaze/core";

/** Value given to every `${NAME}` that isn't set, so Glance doesn't fail on it. */
export const DUMMY_ENV_VALUE = "glaze-validate";

const DEFAULT_TIMEOUT_MS = 10_000;
// Glance prints one line on failure; anything far beyond that is not worth keeping.
const MAX_OUTPUT_BYTES = 64 * 1024;
const MAX_MESSAGE_LENGTH = 600;

/** How to run Glance. */
export interface GlanceCommand {
	/** The Glance binary (`GLANCE_BIN`). */
	readonly bin: string;
	/** Arguments before Glance's own; only tests use this (`node fake-glance.mjs`). */
	readonly prefixArgs?: readonly string[];
	readonly timeoutMs?: number;
}

/** An issue from Glance, before its path (if any) is turned into a line. */
export interface GlanceIssue extends ValidationIssue {
	readonly source: "glance";
}

/**
 * Tells whether a config uses `$include` / `!include`. Glance inlines those
 * before it parses, so its line numbers then don't match the draft.
 * @param text - The config text.
 * @returns True when the text has an include line.
 */
export function hasInclude(text: string): boolean {
	return /^[ \t]*(?:-[ \t]+)?(?:\$include|!include)[ \t]*:/m.test(text);
}

/**
 * Lists the env names a config references as `${NAME}` or
 * `${readFileFromEnv:NAME}`. Glance replaces these in the whole file,
 * comments included, so the whole text is scanned.
 * @param text - The config text.
 * @returns Unique names, in order of first use.
 */
export function collectEnvNames(text: string): string[] {
	const names = new Set<string>();
	for (const match of findEnvReferences(text)) {
		if (match.kind === "env") names.add(match.name);
	}
	return [...names];
}

/**
 * Builds the environment for the Glance process: the server's own env plus a
 * dummy value for every referenced name that isn't set. Real values are passed
 * through untouched and never logged or returned to the browser.
 * @param text - The config text.
 * @param env - The server's environment, usually `process.env`.
 * @returns The child environment.
 */
export function childEnv(
	text: string,
	env: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
	const result: Record<string, string | undefined> = { ...env };
	for (const name of collectEnvNames(text)) {
		if (result[name] === undefined) result[name] = DUMMY_ENV_VALUE;
	}
	return result;
}

/**
 * Replaces `${secret:…}` and `${readFileFromEnv:…}` with a dummy value. Those
 * read files that only exist where Glance runs, so they can't be faked with an
 * env var; replacing them lets Glance check the rest. Each one becomes a warning.
 * Replacing within a line keeps every line number the same.
 * @param text - The config text.
 * @returns The text for Glance and one warning per unique reference.
 */
export function stubFileVariables(text: string): {
	text: string;
	warnings: GlanceIssue[];
} {
	const warnings: GlanceIssue[] = [];
	const seen = new Set<string>();
	let stubbed = text;
	for (const match of findEnvReferences(text)) {
		if (match.kind === "env" || seen.has(match.raw)) continue;
		seen.add(match.raw);
		const at = offsetToLineColumn(text, text.indexOf(match.raw));
		warnings.push({
			severity: "warning",
			source: "glance",
			message: `${match.raw} reads a file where Glance runs; it can't be checked here`,
			line: at.line,
			column: at.column,
		});
		stubbed = stubbed.split(match.raw).join(DUMMY_ENV_VALUE);
	}
	return { text: stubbed, warnings };
}

const PREFIXES = ["Config file is invalid:", "Could not parse config file:"];

function pathFromMessage(message: string): YamlPath | undefined {
	const column = /column (\d+) of page (\d+)/.exec(message);
	if (column) {
		return ["pages", Number(column[2]) - 1, "columns", Number(column[1]) - 1];
	}
	const page = /\bpage (\d+)\b/.exec(message);
	return page ? ["pages", Number(page[1]) - 1] : undefined;
}

function shorten(text: string): string {
	return text.length > MAX_MESSAGE_LENGTH
		? `${text.slice(0, MAX_MESSAGE_LENGTH)}…`
		: text;
}

/**
 * Turns the output of `glance config:validate` into issues.
 * - `Config file is invalid: …` / `Could not parse config file: …` → one error;
 * - `line N` in the message is used only when the draft has no `$include`;
 * - `page N` / `column N of page M` become a path (Glance counts from 1);
 * - errors about secrets, `readFileFromEnv` or a missing assets folder depend
 *   on the machine Glance runs on, so they become warnings;
 * - anything else → one error with the raw output.
 * @param output - Everything Glance printed (stdout and stderr).
 * @param includes - Whether the draft has `$include`s.
 * @returns The issues; empty for empty output.
 */
export function parseGlanceOutput(
	output: string,
	includes: boolean,
): GlanceIssue[] {
	const text = output.trim();
	if (text === "") return [];
	const prefix = PREFIXES.find((candidate) => text.includes(candidate));
	if (!prefix) {
		return [
			{
				severity: "error",
				source: "glance",
				message: `Glance: ${shorten(text)}`,
			},
		];
	}
	const message = text
		.slice(text.indexOf(prefix) + prefix.length)
		.trim()
		.replace(/\s*\n\s*/g, " ");
	const machineSpecific =
		/reading secret file|readFileFromEnv:|assets directory does not exist/.test(
			message,
		);
	const line = includes ? null : /\bline (\d+)\b/.exec(message);
	const path = includes ? undefined : pathFromMessage(message);
	return [
		{
			severity: machineSpecific ? "warning" : "error",
			source: "glance",
			message: machineSpecific
				? `Glance: ${shorten(message)} (can't be checked here)`
				: `Glance: ${shorten(message)}`,
			...(line ? { line: Number(line[1]) } : {}),
			...(path ? { path } : {}),
		},
	];
}

interface RunResult {
	readonly output: string;
	readonly timedOut: boolean;
	readonly missing: boolean;
}

function run(
	command: GlanceCommand,
	configPath: string,
	env: Record<string, string | undefined>,
): Promise<RunResult> {
	return new Promise((resolve) => {
		execFile(
			command.bin,
			[
				...(command.prefixArgs ?? []),
				"--config",
				configPath,
				"config:validate",
			],
			{
				env,
				timeout: command.timeoutMs ?? DEFAULT_TIMEOUT_MS,
				maxBuffer: MAX_OUTPUT_BYTES,
				windowsHide: true,
				encoding: "utf8",
			},
			(error, stdout, stderr) => {
				const output = `${stdout}\n${stderr}`;
				const code =
					error && "code" in error ? (error.code as unknown) : undefined;
				resolve({
					output,
					// A full output buffer also kills the process; that is not a timeout.
					timedOut:
						error?.killed === true &&
						code !== "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
					missing: code === "ENOENT" || code === "EACCES",
				});
			},
		);
	});
}

/**
 * Runs `glance --config <tmp> config:validate` on a draft. The draft goes to a
 * temp file next to the real config, so `$include` paths resolve the same way,
 * and the temp file is always deleted afterwards.
 * @param text - The draft config.
 * @param configPath - Path of the real `glance.yml`.
 * @param command - The Glance binary and timeout.
 * @param env - The server's environment, usually `process.env`.
 * @returns Glance's issues (empty when Glance accepts the draft).
 */
export async function runGlanceValidate(
	text: string,
	configPath: string,
	command: GlanceCommand,
	env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<GlanceIssue[]> {
	const { text: stubbed, warnings } = stubFileVariables(text);
	const tempPath = join(
		dirname(configPath),
		`.glaze-validate-${randomBytes(6).toString("hex")}.yml`,
	);
	try {
		await writeFile(tempPath, stubbed, { encoding: "utf8", flag: "wx" });
		const result = await run(command, tempPath, childEnv(stubbed, env));
		if (result.missing) {
			return [
				{
					severity: "warning",
					source: "glance",
					message: "GLANCE_BIN can't be run; Glance validation was skipped",
				},
			];
		}
		if (result.timedOut) {
			return [
				...warnings,
				{
					severity: "warning",
					source: "glance",
					message: "Glance took too long to validate the config",
				},
			];
		}
		// Glance prints the temp file's name in some errors; show the real one.
		const output = result.output.split(tempPath).join(configPath);
		return [...warnings, ...parseGlanceOutput(output, hasInclude(text))];
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		return [
			{
				severity: "warning",
				source: "glance",
				message: `Glance validation failed to run: ${shorten(reason)}`,
			},
		];
	} finally {
		await rm(tempPath, { force: true });
	}
}
