// Gets the Glance Go source: from a local checkout, or as the tarball of a
// release tag from GitHub (read with a tiny tar reader, so no dependency).
//
// Runs on plain Node (built-in type stripping), so only erasable TypeScript here.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

/** The Go files of the two packages the config uses, keyed by package. */
export interface GlanceSource {
	/** `internal/glance/*.go`, without tests. */
	readonly glance: readonly string[];
	/** `pkg/sysinfo/*.go` (server-stats inlines its request struct). */
	readonly sysinfo: readonly string[];
}

const PACKAGES = {
	glance: "internal/glance/",
	sysinfo: "pkg/sysinfo/",
} as const;

function isSourceFile(name: string): boolean {
	return name.endsWith(".go") && !name.endsWith("_test.go");
}

/**
 * Reads the Go source from a local Glance checkout.
 * @param root - The checkout's root folder.
 * @returns The files of both packages.
 */
export function readLocalSource(root: string): GlanceSource {
	const read = (dir: string) => {
		const path = join(root, dir);
		if (!existsSync(path)) throw new Error(`No ${dir} in ${root}`);
		return readdirSync(path)
			.filter(isSourceFile)
			.sort()
			.map((name) => readFileSync(join(path, name), "utf8"));
	};
	return { glance: read(PACKAGES.glance), sysinfo: read(PACKAGES.sysinfo) };
}

/**
 * Lists the files in a .tar archive (ustar, with pax and GNU long names).
 * @param tar - The uncompressed archive.
 * @returns File paths and contents, in archive order.
 */
export function readTar(tar: Buffer): { path: string; data: Buffer }[] {
	const files: { path: string; data: Buffer }[] = [];
	let offset = 0;
	let longName: string | null = null;
	while (offset + 512 <= tar.length) {
		const header = tar.subarray(offset, offset + 512);
		if (header.every((byte) => byte === 0)) break;
		const text = (start: number, length: number) =>
			header
				.subarray(start, start + length)
				.toString("utf8")
				.replace(/\0.*$/s, "");
		const size = Number.parseInt(text(124, 12).trim() || "0", 8);
		const type = text(156, 1);
		const prefix = text(345, 155);
		const body = tar.subarray(offset + 512, offset + 512 + size);
		let path =
			longName ?? (prefix ? `${prefix}/${text(0, 100)}` : text(0, 100));
		longName = null;
		if (type === "x") {
			// pax header: "<len> path=<value>\n" records for the next file.
			const match = /\d+ path=([^\n]*)\n/.exec(body.toString("utf8"));
			if (match?.[1]) longName = match[1];
		} else if (type === "L") {
			longName = body.toString("utf8").replace(/\0.*$/s, "");
		} else if (type === "0" || type === "") {
			files.push({ path, data: Buffer.from(body) });
		}
		path = "";
		offset += 512 + Math.ceil(size / 512) * 512;
	}
	return files;
}

/**
 * Downloads the source of a Glance release tag from GitHub.
 * @param tag - E.g. `v0.8.7`.
 * @returns The files of both packages.
 */
export async function downloadSource(tag: string): Promise<GlanceSource> {
	const url = `https://codeload.github.com/glanceapp/glance/tar.gz/refs/tags/${tag}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Downloading ${url} failed: HTTP ${response.status}`);
	}
	const tar = gunzipSync(Buffer.from(await response.arrayBuffer()));
	const pick = (dir: string) =>
		readTar(tar)
			// Paths start with "glance-<version>/"; match on the part after it.
			.map((file) => ({ ...file, inner: file.path.replace(/^[^/]+\//, "") }))
			.filter(
				(file) =>
					file.inner.startsWith(dir) &&
					!file.inner.slice(dir.length).includes("/") &&
					isSourceFile(file.inner),
			)
			.sort((a, b) => (a.inner < b.inner ? -1 : 1))
			.map((file) => file.data.toString("utf8"));
	const source = {
		glance: pick(PACKAGES.glance),
		sysinfo: pick(PACKAGES.sysinfo),
	};
	if (source.glance.length === 0) {
		throw new Error(`No internal/glance/*.go files in the ${tag} tarball`);
	}
	return source;
}
