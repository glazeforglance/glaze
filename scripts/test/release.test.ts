import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	compareVersions,
	formatDate,
	lockfileRecordsWorkspaceVersions,
	parseVersion,
	readPackageVersion,
	releaseChangelog,
	setPackageVersion,
	validateNextVersion,
	type Version,
} from "../release-lib.ts";

function version(text: string): Version {
	const parsed = parseVersion(text);
	assert.ok(parsed.ok, `expected ${text} to parse`);
	return parsed.value;
}

describe("parseVersion", () => {
	it("parses releases and pre-releases", () => {
		assert.deepEqual(version("0.1.2"), {
			major: 0,
			minor: 1,
			patch: 2,
			prerelease: [],
		});
		assert.deepEqual(version("0.2.0-rc.1"), {
			major: 0,
			minor: 2,
			patch: 0,
			prerelease: ["rc", "1"],
		});
	});

	it("rejects anything that isn't semver", () => {
		for (const text of [
			"",
			"v0.1.2",
			"0.1",
			"01.2.3",
			"0.1.2-",
			"0.1.2+build",
			"0.1.2-rc.01",
		]) {
			assert.equal(parseVersion(text).ok, false, text);
		}
	});
});

describe("compareVersions", () => {
	it("follows semver precedence", () => {
		const ordered = [
			"0.1.1",
			"0.1.2-alpha",
			"0.1.2-alpha.1",
			"0.1.2-alpha.beta",
			"0.1.2-rc.2",
			"0.1.2-rc.10",
			"0.1.2",
			"0.2.0",
			"1.0.0",
		];
		for (let i = 1; i < ordered.length; i++) {
			const lower = version(ordered[i - 1] ?? "");
			const higher = version(ordered[i] ?? "");
			assert.ok(
				compareVersions(lower, higher) < 0,
				`${ordered[i - 1]} < ${ordered[i]}`,
			);
			assert.ok(
				compareVersions(higher, lower) > 0,
				`${ordered[i]} > ${ordered[i - 1]}`,
			);
		}
		assert.equal(
			compareVersions(version("0.1.2-rc.1"), version("0.1.2-rc.1")),
			0,
		);
	});
});

describe("validateNextVersion", () => {
	it("accepts higher versions", () => {
		assert.deepEqual(validateNextVersion("0.1.1", "0.1.2"), {
			ok: true,
			value: "0.1.2",
		});
		assert.equal(validateNextVersion("0.1.1", "0.2.0-rc.1").ok, true);
		assert.equal(validateNextVersion("0.2.0-rc.1", "0.2.0").ok, true);
	});

	it("rejects equal, lower and invalid versions", () => {
		assert.equal(validateNextVersion("0.1.1", "0.1.1").ok, false);
		assert.equal(validateNextVersion("0.1.1", "0.1.0").ok, false);
		assert.equal(validateNextVersion("0.2.0", "0.2.0-rc.1").ok, false);
		assert.equal(validateNextVersion("0.1.1", "latest").ok, false);
	});
});

describe("setPackageVersion", () => {
	const pkg =
		'{\n\t"name": "web",\n\t"version": "0.1.1",\n\t"devEngines": {\n\t\t"version": "12.15.0"\n\t}\n}\n';

	it("changes only the top-level version", () => {
		const result = setPackageVersion(pkg, "0.1.2");
		assert.ok(result.ok);
		assert.equal(
			result.value,
			pkg.replace('"version": "0.1.1"', '"version": "0.1.2"'),
		);
		assert.deepEqual(readPackageVersion(result.value), {
			ok: true,
			value: "0.1.2",
		});
	});

	it("keeps CRLF line endings", () => {
		const result = setPackageVersion(pkg.replaceAll("\n", "\r\n"), "0.1.2");
		assert.ok(result.ok);
		assert.equal(
			result.value,
			pkg.replace("0.1.1", "0.1.2").replaceAll("\n", "\r\n"),
		);
	});

	it("fails without a version field", () => {
		assert.equal(setPackageVersion('{\n\t"name": "x"\n}\n', "0.1.2").ok, false);
	});
});

describe("releaseChangelog", () => {
	const repo = "https://github.com/glazeforglance/glaze";
	const changelog = [
		"# Changelog",
		"",
		"## [Unreleased]",
		"",
		"### Changed",
		"",
		"- Something.",
		"",
		"## [0.1.1] - 2026-10-26",
		"",
		"- Older.",
		"",
		`[Unreleased]: ${repo}/compare/v0.1.1...HEAD`,
		`[0.1.1]: ${repo}/compare/v0.1.0...v0.1.1`,
		"",
	].join("\n");
	const release = { version: "0.1.2", previous: "0.1.1", date: "2026-10-27" };

	it("dates the Unreleased section and updates the links", () => {
		const expected = [
			"# Changelog",
			"",
			"## [Unreleased]",
			"",
			"## [0.1.2] - 2026-10-27",
			"",
			"### Changed",
			"",
			"- Something.",
			"",
			"## [0.1.1] - 2026-10-26",
			"",
			"- Older.",
			"",
			`[Unreleased]: ${repo}/compare/v0.1.2...HEAD`,
			`[0.1.2]: ${repo}/compare/v0.1.1...v0.1.2`,
			`[0.1.1]: ${repo}/compare/v0.1.0...v0.1.1`,
			"",
		].join("\n");
		assert.deepEqual(releaseChangelog(changelog, release), {
			ok: true,
			value: expected,
		});
	});

	it("keeps CRLF line endings", () => {
		const result = releaseChangelog(
			changelog.replaceAll("\n", "\r\n"),
			release,
		);
		assert.ok(result.ok);
		assert.ok(!/[^\r]\n/.test(result.value), "every newline is CRLF");
	});

	it("refuses an empty Unreleased section", () => {
		const empty = changelog.replace("### Changed\n\n- Something.\n\n", "");
		const result = releaseChangelog(empty, release);
		assert.equal(result.ok, false);
	});

	it("refuses an empty Unreleased section right before the links", () => {
		const onlyUnreleased = `# Changelog\n\n## [Unreleased]\n\n[Unreleased]: ${repo}/compare/v0.1.1...HEAD\n`;
		assert.equal(releaseChangelog(onlyUnreleased, release).ok, false);
	});

	it("refuses a version that already has a section", () => {
		assert.equal(
			releaseChangelog(changelog, { ...release, version: "0.1.1" }).ok,
			false,
		);
	});

	it("refuses a file without the Unreleased heading or link", () => {
		assert.equal(
			releaseChangelog(
				changelog.replace("## [Unreleased]", "## Unreleased"),
				release,
			).ok,
			false,
		);
		assert.equal(
			releaseChangelog(changelog.replace(/^\[Unreleased\]:.*$/m, ""), release)
				.ok,
			false,
		);
	});
});

describe("formatDate", () => {
	it("pads month and day", () => {
		assert.equal(formatDate(new Date(2026, 0, 5)), "2026-01-05");
	});
});

describe("lockfileRecordsWorkspaceVersions", () => {
	const names = ["glaze", "server", "@glaze/core"];

	it("is false when workspace packages are only linked", () => {
		const lockfile =
			"importers:\n  apps/server:\n    dependencies:\n      '@glaze/core':\n        specifier: workspace:*\n        version: link:../../packages/core\n";
		assert.equal(
			lockfileRecordsWorkspaceVersions(lockfile, names, "0.1.1"),
			false,
		);
	});

	it("is true when a workspace package is recorded with its version", () => {
		assert.equal(
			lockfileRecordsWorkspaceVersions(
				"  '@glaze/core@0.1.1':\n",
				names,
				"0.1.1",
			),
			true,
		);
		assert.equal(
			lockfileRecordsWorkspaceVersions("  server@0.1.1:\n", names, "0.1.1"),
			true,
		);
	});

	it("ignores other packages that happen to end in a workspace name", () => {
		assert.equal(
			lockfileRecordsWorkspaceVersions(
				"  some-server@0.1.1:\n  '@x/server@0.1.1':\n",
				names,
				"0.1.1",
			),
			false,
		);
	});
});
