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
	/** The config file, its folder, or the `GLAZE_ASSETS_PATH` folder. */
	readonly kind: "file" | "folder" | "assets";
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
	const what = {
		file: "the config file",
		folder: "the config folder",
		assets: "the assets folder (GLAZE_ASSETS_PATH)",
	}[kind];
	const why = {
		file: "Glaze must read and write glance.yml.",
		folder:
			"Glaze writes a temp file next to glance.yml and renames it, and keeps .glaze/ there, so the folder must be writable.",
		assets:
			"Glaze reads and writes the CSS and JS files there, through a temp file it renames, so the folder must be readable and writable.",
	}[kind];
	const lines = [`${who} ${missing} ${what} ${path}${owned}.`, why];
	if (owner && self && owner.uid !== self.uid) {
		lines.push(
			`Fix: set \`user: "${owner.uid}:${owner.gid}"\` for Glaze in your compose file, or run \`chown -R ${self.uid}:${self.gid}\` on the ${kind === "assets" ? "assets" : "config"} folder. See "File permissions" in the README.`,
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

/**
 * Checks on startup that the `GLAZE_ASSETS_PATH` folder exists and that
 * Glaze can read and write it, with the same kind of message as the config check.
 * @param assetsPath - Absolute path of the folder.
 * @returns Nothing, or a message to print before exiting.
 */
export async function checkAssetsAccess(
	assetsPath: string,
): Promise<Result<void, string>> {
	let isFolder = false;
	try {
		isFolder = (await stat(assetsPath)).isDirectory();
	} catch {
		// Handled below, like a missing folder.
	}
	if (!isFolder) {
		return err(
			`GLAZE_ASSETS_PATH folder not found: ${assetsPath}
Mount the folder Glance serves as server.assets-path into Glaze (e.g. at /config/assets), or remove GLAZE_ASSETS_PATH.`,
		);
	}
	const read = await can(assetsPath, constants.R_OK | constants.X_OK);
	const write = await can(assetsPath, constants.W_OK);
	if (read && write) return ok(undefined);
	return err(
		describeAccessProblem({
			path: assetsPath,
			kind: "assets",
			missing: !read && !write ? "read and write" : read ? "write" : "read",
			owner: await ownerOf(assetsPath),
			self: currentIds(),
		}),
	);
}
