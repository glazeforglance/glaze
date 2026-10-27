// Prepares a release: bumps every workspace version and moves the Unreleased
// CHANGELOG section into a dated one. It never commits, pushes or tags; it
// prints those commands instead. See RELEASING.md.
//
//   pnpm release:prepare 0.1.2
//
// Runs on plain Node (built-in type stripping), so only erasable TypeScript here.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	formatDate,
	lockfileRecordsWorkspaceVersions,
	readPackageVersion,
	releaseChangelog,
	setPackageVersion,
	validateNextVersion,
} from "./release-lib.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = [
	"package.json",
	"apps/web/package.json",
	"apps/server/package.json",
	"packages/core/package.json",
];
const CHANGELOG = "CHANGELOG.md";
const LOCKFILE = "pnpm-lock.yaml";
const BRANCH = "main";

function fail(message: string): never {
	console.error(`✗ ${message}`);
	process.exit(1);
}

function read(path: string): string {
	return readFileSync(join(ROOT, path), "utf8");
}

function git(...args: string[]): string {
	return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

const next = process.argv[2];
if (next === undefined)
	fail("Usage: pnpm release:prepare <version>   (e.g. 0.1.2 or 0.2.0-rc.1)");

const current = readPackageVersion(read("package.json"));
if (!current.ok) fail(`package.json: ${current.error}`);
const valid = validateNextVersion(current.value, next);
if (!valid.ok) fail(valid.error);

if (git("status", "--porcelain") !== "")
	fail("The working tree isn't clean; commit or stash your changes first");
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== BRANCH)
	fail(`You're on "${branch}"; releases are made from "${BRANCH}"`);

// Compute every new file before writing any, so a failure leaves nothing half-done.
const writes = new Map<string, string>();
const names: string[] = [];
for (const path of PACKAGES) {
	const text = read(path);
	const updated = setPackageVersion(text, next);
	if (!updated.ok) fail(`${path}: ${updated.error}`);
	writes.set(path, updated.value);
	const name: unknown = JSON.parse(text).name;
	if (typeof name === "string") names.push(name);
}
const changelog = releaseChangelog(read(CHANGELOG), {
	version: next,
	previous: current.value,
	date: formatDate(new Date()),
});
if (!changelog.ok) fail(changelog.error);
writes.set(CHANGELOG, changelog.value);

// Check before the bump: afterwards package.json and the lockfile disagree.
const lockfileNeedsUpdate = lockfileRecordsWorkspaceVersions(
	read(LOCKFILE),
	names,
	current.value,
);

for (const [path, text] of writes) {
	writeFileSync(join(ROOT, path), text);
	console.log(`✓ ${path}`);
}

if (lockfileNeedsUpdate) {
	// pnpm is a .cmd shim on Windows, which only runs through a shell.
	execFileSync("pnpm", ["install", "--lockfile-only"], {
		cwd: ROOT,
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	console.log(`✓ ${LOCKFILE}`);
} else {
	console.log(`· ${LOCKFILE} doesn't record workspace versions, skipped`);
}

console.log(`
Prepared v${next} (was v${current.value}). Review the diff, then run:

  git commit -am "chore(release): v${next}"
  git push
  # wait for CI to pass on ${BRANCH}
  git tag -a v${next} -m "Glaze v${next}"
  git push origin v${next}
`);
