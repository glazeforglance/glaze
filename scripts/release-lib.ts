// Pure helpers for scripts/release.ts: version checks and file rewrites.
// No file system or git here, so everything can be tested on strings.
//
// Runs on plain Node (built-in type stripping), so only erasable TypeScript here.

import { err, ok, type Result } from "../packages/core/src/result.ts";

/** A parsed semantic version (no build metadata: tags and image names don't allow `+`). */
export interface Version {
	readonly major: number;
	readonly minor: number;
	readonly patch: number;
	/** Pre-release identifiers, e.g. `["rc", "1"]` for `-rc.1`; empty for a release. */
	readonly prerelease: readonly string[];
}

// From semver.org, without the build-metadata part.
const SEMVER =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;

/**
 * Parses a semantic version like `0.1.2` or `0.2.0-rc.1`.
 * @param text - The version, without a leading `v`.
 * @returns The parsed version, or an error message.
 */
export function parseVersion(text: string): Result<Version, string> {
	const match = SEMVER.exec(text);
	if (!match) {
		return err(`"${text}" is not a semantic version like 1.2.3 or 1.2.3-rc.1`);
	}
	return ok({
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		prerelease: match[4] === undefined ? [] : match[4].split("."),
	});
}

/**
 * Compares two versions by semver precedence.
 * @param a - The first version.
 * @param b - The second version.
 * @returns A negative number when `a < b`, 0 when equal, positive when `a > b`.
 */
export function compareVersions(a: Version, b: Version): number {
	const core = a.major - b.major || a.minor - b.minor || a.patch - b.patch;
	if (core !== 0) return core;
	// A release ranks above its own pre-releases.
	if (a.prerelease.length === 0 || b.prerelease.length === 0) {
		return b.prerelease.length - a.prerelease.length;
	}
	const length = Math.max(a.prerelease.length, b.prerelease.length);
	for (let i = 0; i < length; i++) {
		const x = a.prerelease[i];
		const y = b.prerelease[i];
		// More identifiers rank higher when all earlier ones are equal.
		if (x === undefined) return -1;
		if (y === undefined) return 1;
		if (x === y) continue;
		const xNumeric = /^\d+$/.test(x);
		const yNumeric = /^\d+$/.test(y);
		if (xNumeric && yNumeric) return Number(x) - Number(y);
		// Numeric identifiers rank below alphanumeric ones.
		if (xNumeric) return -1;
		if (yNumeric) return 1;
		return x < y ? -1 : 1;
	}
	return 0;
}

/**
 * Checks that `next` is a valid version and higher than `current`.
 * @param current - The version in package.json now.
 * @param next - The version to release.
 * @returns `next` unchanged when it's valid, or an error message.
 */
export function validateNextVersion(
	current: string,
	next: string,
): Result<string, string> {
	const parsedNext = parseVersion(next);
	if (!parsedNext.ok) return parsedNext;
	const parsedCurrent = parseVersion(current);
	if (!parsedCurrent.ok) {
		return err(
			`The current version in package.json is invalid: ${parsedCurrent.error}`,
		);
	}
	if (compareVersions(parsedNext.value, parsedCurrent.value) <= 0) {
		return err(`${next} is not higher than the current version ${current}`);
	}
	return ok(next);
}

// Only the top-level field: one tab of indentation, as Biome formats package.json.
const VERSION_FIELD = /^(\t"version":\s*")([^"]*)(")/m;

/**
 * Reads the top-level `"version"` of a package.json.
 * @param packageJson - The file's text.
 * @returns The version, or an error message when the field is missing.
 */
export function readPackageVersion(
	packageJson: string,
): Result<string, string> {
	const match = VERSION_FIELD.exec(packageJson);
	return match?.[2] === undefined
		? err('no top-level "version" field')
		: ok(match[2]);
}

/**
 * Sets the top-level `"version"` of a package.json. Only that value changes, so
 * indentation, key order and line endings stay as they are.
 * @param packageJson - The file's text.
 * @param version - The new version.
 * @returns The updated text, or an error message when the field is missing.
 */
export function setPackageVersion(
	packageJson: string,
	version: string,
): Result<string, string> {
	if (!VERSION_FIELD.test(packageJson))
		return err('no top-level "version" field');
	return ok(
		packageJson.replace(
			VERSION_FIELD,
			(_all, before, _old, after) => `${before}${version}${after}`,
		),
	);
}

const UNRELEASED_HEADING = "## [Unreleased]";
const UNRELEASED_LINK = /^\[Unreleased\]: (\S+)\/compare\/v\S+\.\.\.HEAD$/;
// The link definitions at the bottom end the last section.
const SECTION_END = /^(## \[|\[[^\]]+\]: )/;

/** Input for {@link releaseChangelog}. */
export interface ChangelogRelease {
	/** The version being released, e.g. `0.1.2`. */
	readonly version: string;
	/** The version it follows, e.g. `0.1.1`; used for the compare link. */
	readonly previous: string;
	/** The release date as `YYYY-MM-DD`. */
	readonly date: string;
}

/**
 * Moves the `## [Unreleased]` section of a Keep a Changelog file into a new
 * `## [<version>] - <date>` section, adds an empty Unreleased section above it
 * and updates the compare links at the bottom. Line endings are preserved.
 * @param changelog - The CHANGELOG.md text.
 * @param release - The version, the previous version and the date.
 * @returns The updated text, or an error message when the file can't be released.
 */
export function releaseChangelog(
	changelog: string,
	release: ChangelogRelease,
): Result<string, string> {
	const eol = changelog.includes("\r\n") ? "\r\n" : "\n";
	const lines = changelog.split(/\r?\n/);
	const { version, previous, date } = release;

	if (lines.some((line) => line.startsWith(`## [${version}]`))) {
		return err(`CHANGELOG.md already has a section for ${version}`);
	}
	const start = lines.indexOf(UNRELEASED_HEADING);
	if (start === -1)
		return err(`CHANGELOG.md has no "${UNRELEASED_HEADING}" heading`);
	let end = lines.findIndex((line, i) => i > start && SECTION_END.test(line));
	if (end === -1) end = lines.length;
	if (lines.slice(start + 1, end).every((line) => line.trim() === "")) {
		return err(
			"The Unreleased section in CHANGELOG.md is empty; add the changes first",
		);
	}

	const linkIndex = lines.findIndex((line) => UNRELEASED_LINK.test(line));
	const repoUrl =
		linkIndex === -1
			? undefined
			: UNRELEASED_LINK.exec(lines[linkIndex] ?? "")?.[1];
	if (repoUrl === undefined) {
		return err(
			'CHANGELOG.md has no "[Unreleased]: <repo>/compare/v<version>...HEAD" link',
		);
	}

	const result = [...lines];
	// Replace the link first: it sits below the heading, so the heading's index stays valid.
	result.splice(
		linkIndex,
		1,
		`[Unreleased]: ${repoUrl}/compare/v${version}...HEAD`,
		`[${version}]: ${repoUrl}/compare/v${previous}...v${version}`,
	);
	result.splice(start, 1, UNRELEASED_HEADING, "", `## [${version}] - ${date}`);
	return ok(result.join(eol));
}

/**
 * Formats a date as `YYYY-MM-DD` in local time (the maintainer's "today").
 * @param date - The date to format.
 * @returns The formatted date.
 */
export function formatDate(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Tells whether pnpm-lock.yaml records the version of a workspace package, in
 * which case it must be regenerated after a version bump. Recent pnpm versions
 * link workspace packages (`link:../../packages/core`) and don't record it.
 * @param lockfile - The pnpm-lock.yaml text.
 * @param names - The workspace package names, e.g. `["glaze", "@glaze/core"]`.
 * @param version - The current workspace version.
 * @returns True when a `<name>@<version>` entry exists.
 */
export function lockfileRecordsWorkspaceVersions(
	lockfile: string,
	names: readonly string[],
	version: string,
): boolean {
	const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return names.some((name) =>
		new RegExp(
			`(^|[\\s'"])${escape(`${name}@${version}`)}(?=[\\s'":(]|$)`,
			"m",
		).test(lockfile),
	);
}
