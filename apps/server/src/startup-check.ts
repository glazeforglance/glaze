import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { err, ok, type Result } from "@glaze/core";

/** A user and group id. */
export interface Ids {
	readonly uid: number;
	readonly gid: number;
}

/** What `describeAccessProblem` needs to explain a permission problem. */
export interface AccessProblem {
	readonly path: string;
	readonly kind: "file" | "folder";
	/** What Glaze needs and doesn't have. */
	readonly missing: "read" | "write" | "read and write";
	/** Owner of the path, when `stat` worked. */
	readonly owner: Ids | null;
	/** Who Glaze runs as; `null` on Windows (no uids). */
	readonly self: Ids | null;
}

/**
 * Explains a permission problem in a way that leads to the fix: who Glaze
 * runs as, who owns the file, and the compose `user:` option.
 * @param problem - The path, what's missing and the ids involved.
 * @returns A message for the startup log.
 */
export function describeAccessProblem(problem: AccessProblem): string {
	const { path, kind, missing, owner, self } = problem;
	const who = self
		? `Glaze runs as uid ${self.uid} (gid ${self.gid}) but can't`
		: "Glaze can't";
	const owned = owner
		? `, which is owned by uid ${owner.uid} (gid ${owner.gid})`
		: "";
	const lines = [
		`${who} ${missing} the config ${kind} ${path}${owned}.`,
		kind === "folder"
			? "Glaze writes a temp file next to glance.yml and renames it, and keeps .glaze/ there, so the folder must be writable."
			: "Glaze must read and write glance.yml.",
	];
	if (owner && self && owner.uid !== self.uid) {
		lines.push(
			`Fix: set \`user: "${owner.uid}:${owner.gid}"\` for Glaze in your compose file, or run \`chown -R ${self.uid}:${self.gid}\` on the config folder. See "File permissions" in the README.`,
		);
	} else {
		lines.push('Check the permissions, see "File permissions" in the README.');
	}
	return lines.join("\n");
}

function currentIds(): Ids | null {
	return typeof process.getuid === "function" &&
		typeof process.getgid === "function"
		? { uid: process.getuid(), gid: process.getgid() }
		: null;
}

async function can(path: string, mode: number): Promise<boolean> {
	try {
		await access(path, mode);
		return true;
	} catch {
		return false;
	}
}

async function ownerOf(path: string): Promise<Ids | null> {
	try {
		const info = await stat(path);
		return { uid: info.uid, gid: info.gid };
	} catch {
		return null;
	}
}

/**
 * Checks on startup that Glaze can read and write `glance.yml` and its
 * folder, so a permission problem shows up as one clear message instead of
 * a failed Publish later.
 * @param configPath - Absolute path of `glance.yml`.
 * @returns Nothing, or a message to print before exiting.
 */
export async function checkConfigAccess(
	configPath: string,
): Promise<Result<void, string>> {
	const folder = dirname(configPath);
	const self = currentIds();
	if (!(await can(configPath, constants.F_OK))) {
		return err(
			`Config file not found: ${configPath}\nCreate it (Glance needs it too) or set GLAZE_CONFIG_PATH. In Docker, mount the folder that holds glance.yml at /config.`,
		);
	}
	const read = await can(configPath, constants.R_OK);
	const write = await can(configPath, constants.W_OK);
	if (!read || !write) {
		return err(
			describeAccessProblem({
				path: configPath,
				kind: "file",
				missing: !read && !write ? "read and write" : read ? "write" : "read",
				owner: await ownerOf(configPath),
				self,
			}),
		);
	}
	if (!(await can(folder, constants.W_OK | constants.X_OK))) {
		return err(
			describeAccessProblem({
				path: folder,
				kind: "folder",
				missing: "write",
				owner: await ownerOf(folder),
				self,
			}),
		);
	}
	return ok(undefined);
}
