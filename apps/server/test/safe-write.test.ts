import {
	chmod,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import {
	waitForPendingWrites,
	type WriteFs,
	writeFileSafely,
} from "../src/config-store.ts";
import {
	checkConfigAccess,
	describeAccessProblem,
} from "../src/startup-check.ts";

let dir: string;
let path: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "glaze-write-"));
	path = join(dir, "glance.yml");
	await writeFile(path, "old: 1\n", "utf8");
});

afterEach(async () => {
	await chmod(path, 0o644).catch(() => {});
	await rm(dir, { recursive: true, force: true });
});

/** The real file system, with `rename` failing like a bind-mounted file. */
function failingRename(code: string): WriteFs {
	return {
		writeFile: (file, data, options) => fs.writeFile(file, data, options),
		rm: (file, options) => fs.rm(file, options),
		rename: vi.fn(async () => {
			throw Object.assign(new Error(`${code}: rename failed`), { code });
		}),
	};
}

describe("writeFileSafely", () => {
	it("writes through a temp file and a rename", async () => {
		expect(await writeFileSafely(path, "new: 2\n")).toEqual({
			ok: true,
			value: "renamed",
		});
		expect(await readFile(path, "utf8")).toBe("new: 2\n");
		expect(await readdir(dir)).toEqual(["glance.yml"]);
	});

	it.each(["EBUSY", "EXDEV", "EPERM"])(
		"falls back to an in-place write when rename fails with %s",
		async (code) => {
			const files = failingRename(code);
			expect(await writeFileSafely(path, "new: 2\n", files)).toEqual({
				ok: true,
				value: "in-place",
			});
			expect(files.rename).toHaveBeenCalledOnce();
			expect(await readFile(path, "utf8")).toBe("new: 2\n");
			// The temp file is cleaned up either way.
			expect(await readdir(dir)).toEqual(["glance.yml"]);
		},
	);

	it("doesn't fall back for other errors and leaves the file alone", async () => {
		const result = await writeFileSafely(
			path,
			"new: 2\n",
			failingRename("EACCES"),
		);
		expect(result.ok).toBe(false);
		expect(await readFile(path, "utf8")).toBe("old: 1\n");
		expect(await readdir(dir)).toEqual(["glance.yml"]);
	});

	it("lets a shutdown wait for writes in progress", async () => {
		let release: () => void = () => {};
		const slow: WriteFs = {
			...failingRename("EBUSY"),
			rename: () =>
				new Promise<void>((resolve) => {
					release = resolve;
				}),
		};
		const write = writeFileSafely(path, "new: 2\n", slow);
		let waited = false;
		const waiting = waitForPendingWrites().then(() => {
			waited = true;
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(waited).toBe(false);
		release();
		await write;
		await waiting;
		expect(waited).toBe(true);
	});
});

describe("checkConfigAccess", () => {
	it("accepts a readable, writable file in a writable folder", async () => {
		expect(await checkConfigAccess(path)).toEqual({
			ok: true,
			value: undefined,
		});
	});

	it("explains a missing file", async () => {
		const result = await checkConfigAccess(join(dir, "missing.yml"));
		expect(!result.ok && result.error).toMatch(/not found.*GLAZE_CONFIG_PATH/s);
	});

	// Root ignores file modes, so this only means something for normal users.
	it.skipIf(process.getuid?.() === 0)("refuses a read-only file", async () => {
		await chmod(path, 0o444);
		const result = await checkConfigAccess(path);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.error).toMatch(/can't write/);
	});
});

describe("describeAccessProblem", () => {
	it("names both uids and the compose fix", () => {
		const message = describeAccessProblem({
			path: "/config/glance.yml",
			kind: "file",
			missing: "write",
			owner: { uid: 0, gid: 0 },
			self: { uid: 1000, gid: 1000 },
		});
		expect(message).toContain(
			"Glaze runs as uid 1000 (gid 1000) but can't write the config file /config/glance.yml, which is owned by uid 0 (gid 0).",
		);
		expect(message).toContain('user: "0:0"');
		expect(message).toContain("README");
	});

	it("works without uids (Windows)", () => {
		const message = describeAccessProblem({
			path: "C:\\config",
			kind: "folder",
			missing: "write",
			owner: null,
			self: null,
		});
		expect(message).toMatch(/^Glaze can't write the config folder/);
	});
});
