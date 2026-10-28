import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	ASSETS_DOCS_URL,
	childEnv,
	collectEnvNames,
	DUMMY_ENV_VALUE,
	type GlanceCommand,
	hasInclude,
	parseGlanceOutput,
	pointAssetsPath,
	runGlanceValidate,
	stubFileVariables,
} from "../src/glance-validate.ts";
import { validateDraft } from "../src/validate.ts";

const FAKE_GLANCE = fileURLToPath(
	new URL("./fixtures/fake-glance.mjs", import.meta.url),
);
const FAKE: GlanceCommand = {
	bin: process.execPath,
	prefixArgs: [FAKE_GLANCE],
};

// Fake values only.
const VALID = `pages:
  - name: Home
    columns:
      - size: small
      - size: full
        widgets:
          - type: clock
`;

let dir: string;
let configPath: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "glaze-glance-"));
	configPath = join(dir, "glance.yml");
	await writeFile(configPath, VALID, "utf8");
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("parseGlanceOutput", () => {
	it("reads the line from a YAML error", () => {
		const [issue] = parseGlanceOutput(
			"Could not parse config file: yaml: line 12: mapping values are not allowed\n",
			false,
		);
		expect(issue).toMatchObject({
			severity: "error",
			source: "glance",
			line: 12,
		});
		expect(issue?.message).toContain("mapping values are not allowed");
	});

	it("ignores the line when the draft has includes", () => {
		const [issue] = parseGlanceOutput(
			"Could not parse config file: yaml: line 12: oops",
			true,
		);
		expect(issue?.line).toBeUndefined();
		expect(issue?.severity).toBe("error");
	});

	it("turns page and column numbers into a path", () => {
		const [column] = parseGlanceOutput(
			"Config file is invalid: column 3 of page 2: size can only be either small or full",
			false,
		);
		expect(column?.path).toEqual(["pages", 1, "columns", 2]);
		const [page] = parseGlanceOutput(
			"Config file is invalid: page 1 has more than 3 columns",
			false,
		);
		expect(page?.path).toEqual(["pages", 0]);
	});

	it("makes machine-specific errors warnings", () => {
		for (const output of [
			"Config file is invalid: parsing variable: reading secret file: open /run/secrets/a: no such file",
			"Config file is invalid: parsing variable: readFileFromEnv: environment variable X not found",
		]) {
			const [issue] = parseGlanceOutput(output, false);
			expect(issue?.severity).toBe("warning");
			expect(issue?.message).toContain("can't be checked here");
		}
	});

	describe("a missing assets folder", () => {
		const output =
			"Config file is invalid: assets directory does not exist: /assets/";

		it("is an info with a docs link without GLAZE_ASSETS_PATH", () => {
			const [issue] = parseGlanceOutput(output, false, "unset");
			expect(issue).toMatchObject({
				severity: "info",
				docsUrl: ASSETS_DOCS_URL,
			});
			expect(issue?.message).toContain("GLAZE_ASSETS_PATH");
		});

		it("is a warning when GLAZE_ASSETS_PATH doesn't exist", () => {
			const [issue] = parseGlanceOutput(output, false, "missing");
			expect(issue?.severity).toBe("warning");
			expect(issue?.message).toContain("GLAZE_ASSETS_PATH doesn't exist");
		});

		it("is Glance's own warning when it was really checked", () => {
			const [issue] = parseGlanceOutput(output, false, "checked");
			expect(issue?.severity).toBe("warning");
			expect(issue?.message).toContain("/assets/");
		});
	});

	it("keeps unrecognised output as one raw error", () => {
		expect(parseGlanceOutput("panic: boom\ngoroutine 1", false)).toEqual([
			{
				severity: "error",
				source: "glance",
				code: "glance-output",
				params: { output: "panic: boom\ngoroutine 1" },
				message: "Glance: panic: boom\ngoroutine 1",
			},
		]);
		expect(parseGlanceOutput("  \n", false)).toEqual([]);
	});
});

describe("env helpers", () => {
	const text =
		"a: ${API_KEY}\n# b: ${IN_COMMENT}\nc: ${lower}\nd: \\${ESCAPED}\ne: ${secret:token}\n";

	it("collects env names, comments included, like Glance", () => {
		expect(collectEnvNames(text)).toEqual(["API_KEY", "IN_COMMENT"]);
	});

	it("adds dummies only for names that aren't set", () => {
		const env = childEnv(text, { API_KEY: "real-value", PATH: "/bin" });
		expect(env.API_KEY).toBe("real-value");
		expect(env.IN_COMMENT).toBe(DUMMY_ENV_VALUE);
		expect(env.PATH).toBe("/bin");
	});

	it("stubs secrets without changing line numbers", () => {
		const { text: stubbed, warnings } = stubFileVariables(text);
		expect(stubbed).not.toContain("${secret:");
		expect(stubbed.split("\n").length).toBe(text.split("\n").length);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatchObject({ severity: "warning", line: 5 });
	});

	it("detects includes", () => {
		expect(hasInclude("pages:\n  - $include: home.yml\n")).toBe(true);
		expect(hasInclude("x:\n  !include: a.yml\n")).toBe(true);
		expect(hasInclude("title: $include is a word\n")).toBe(false);
	});
});

describe("runGlanceValidate (fake Glance)", () => {
	it("returns nothing for a valid config and cleans up", async () => {
		expect(await runGlanceValidate(VALID, configPath, FAKE)).toEqual([]);
		expect(await readdir(dir)).toEqual(["glance.yml"]);
	});

	it("parses a line number from Glance's output", async () => {
		const issues = await runGlanceValidate(
			`# fake: yaml-error\n${VALID}`,
			configPath,
			FAKE,
		);
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({ severity: "error", line: 3 });
		expect(await readdir(dir)).toEqual(["glance.yml"]);
	});

	it("drops the line number when the draft has an include", async () => {
		await writeFile(join(dir, "extra.yml"), "- name: Extra\n", "utf8");
		const issues = await runGlanceValidate(
			`# fake: yaml-error\n${VALID}  - $include: extra.yml\n`,
			configPath,
			FAKE,
		);
		expect(issues[0]?.severity).toBe("error");
		expect(issues[0]?.line).toBeUndefined();
	});

	it("gives missing env vars a dummy value, so they cause no error", async () => {
		const text = VALID.replace(
			"type: clock",
			"type: clock\n            title: ${CLOCK_TITLE}",
		);
		expect(await runGlanceValidate(text, configPath, FAKE, {})).toEqual([]);
	});

	it("runs on a temp file next to the config and passes real values through", async () => {
		const record = join(
			await mkdtemp(join(tmpdir(), "glaze-record-")),
			"r.json",
		);
		const text = `# fake: record\n# \${SET_VAR} \${UNSET_VAR}\n${VALID}`;
		await runGlanceValidate(text, configPath, FAKE, {
			FAKE_GLANCE_RECORD: record,
			SET_VAR: "real",
		});
		const seen = JSON.parse(await readFile(record, "utf8")) as {
			configPath: string;
			text: string;
			env: Record<string, string>;
		};
		expect(dirname(seen.configPath)).toBe(dir);
		expect(basename(seen.configPath)).toMatch(
			/^\.glaze-validate-[0-9a-f]+\.yml$/,
		);
		expect(seen.text).toBe(text);
		expect(seen.env).toEqual({ SET_VAR: "real", UNSET_VAR: DUMMY_ENV_VALUE });
		expect(await readdir(dir)).toEqual(["glance.yml"]);
		await rm(dirname(record), { recursive: true, force: true });
	});

	it("turns secrets into warnings and still checks the rest", async () => {
		const text = `# fake: column-size\n${VALID}`.replace(
			"type: clock",
			"type: clock\n            title: ${secret:clock_title}",
		);
		const issues = await runGlanceValidate(text, configPath, FAKE, {});
		expect(issues.map((issue) => issue.severity)).toEqual(["warning", "error"]);
		expect(issues[0]?.message).toContain("${secret:clock_title}");
		expect(issues[1]?.path).toEqual(["pages", 0, "columns", 1]);
	});

	it("makes a secret error from an included file a warning", async () => {
		const issues = await runGlanceValidate(
			`# fake: secret-file\n${VALID}`,
			configPath,
			FAKE,
		);
		expect(issues[0]?.severity).toBe("warning");
	});

	it("reports unrecognised output as one error", async () => {
		const issues = await runGlanceValidate(
			`# fake: garbage\n${VALID}`,
			configPath,
			FAKE,
		);
		expect(issues).toEqual([
			{
				severity: "error",
				source: "glance",
				code: "glance-output",
				params: { output: "panic: something unexpected" },
				message: "Glance: panic: something unexpected",
			},
		]);
	});

	it("stops after the timeout and still cleans up", async () => {
		const started = Date.now();
		const issues = await runGlanceValidate(
			`# fake: timeout\n${VALID}`,
			configPath,
			{
				...FAKE,
				timeoutMs: 400,
			},
		);
		expect(Date.now() - started).toBeLessThan(5000);
		expect(issues[0]).toMatchObject({ severity: "warning" });
		expect(issues[0]?.message).toContain("too long");
		expect(await readdir(dir)).toEqual(["glance.yml"]);
	});

	it("warns when the binary doesn't exist", async () => {
		const issues = await runGlanceValidate(VALID, configPath, {
			bin: join(dir, "no-such-glance"),
		});
		expect(issues[0]?.severity).toBe("warning");
		expect(await readdir(dir)).toEqual(["glance.yml"]);
	});
});

describe("assets-path in the validation copy", () => {
	const WITH_ASSETS = `server:\n  assets-path: /assets/ # Glance's path\n${VALID}`;

	it("points only server.assets-path at GLAZE_ASSETS_PATH", () => {
		const pointed = pointAssetsPath(WITH_ASSETS, "/config/assets");
		expect(pointed).toContain("assets-path: /config/assets");
		expect(pointed).toContain("# Glance's path");
		expect(pointed?.split("\n").length).toBe(WITH_ASSETS.split("\n").length);
	});

	it("leaves configs without an assets path or with a placeholder alone", () => {
		expect(pointAssetsPath(VALID, "/config/assets")).toBeNull();
		expect(
			pointAssetsPath(
				"server:\n  assets-path: ${ASSETS}\npages: []\n",
				"/config/assets",
			),
		).toBeNull();
	});

	it("lets Glance check the folder when GLAZE_ASSETS_PATH exists", async () => {
		await writeFile(configPath, WITH_ASSETS, "utf8");
		const assetsDir = join(dir, "assets");
		await mkdir(assetsDir);
		const issues = await runGlanceValidate(
			WITH_ASSETS,
			configPath,
			FAKE,
			{},
			assetsDir,
		);
		expect(issues).toEqual([]);
		// The real file is never changed.
		expect(await readFile(configPath, "utf8")).toBe(WITH_ASSETS);
	});

	it("gives one info without GLAZE_ASSETS_PATH", async () => {
		const issues = await runGlanceValidate(WITH_ASSETS, configPath, FAKE, {});
		expect(issues).toEqual([
			expect.objectContaining({ severity: "info", docsUrl: ASSETS_DOCS_URL }),
		]);
	});

	it("warns when GLAZE_ASSETS_PATH doesn't exist", async () => {
		const issues = await runGlanceValidate(
			WITH_ASSETS,
			configPath,
			FAKE,
			{},
			join(dir, "nope"),
		);
		expect(issues).toEqual([expect.objectContaining({ severity: "warning" })]);
	});
});

describe("validateDraft", () => {
	it("reports a broken server.host on its line", async () => {
		const text = `server:\n  host: http://192.168.178.233\n${VALID}`;
		const issues = await validateDraft(text, { configPath, glance: null });
		expect(issues[0]).toMatchObject({
			severity: "error",
			path: ["server", "host"],
			line: 2,
		});
	});

	it("asks to confirm a port change when Glance runs in a container", async () => {
		const text = `server:\n  port: 8088\n${VALID}`;
		const options = {
			configPath,
			glance: null,
			publishedText: VALID,
			glazeInContainer: true,
		};
		const [issue] = await validateDraft(text, options);
		expect(issue).toMatchObject({
			severity: "warning",
			path: ["server", "port"],
			line: 2,
			requiresConfirmation: true,
		});
		const unchanged = await validateDraft(VALID, options);
		expect(unchanged.some((entry) => entry.requiresConfirmation)).toBe(false);
	});

	it("reports a YAML error with line and column and stops", async () => {
		const issues = await validateDraft("pages:\n  - name: A\n   bad: x\n", {
			configPath,
			glance: FAKE,
		});
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			severity: "error",
			source: "yaml",
			line: 3,
		});
		expect(issues[0]?.column).toBeGreaterThan(0);
	});

	it("reports layout errors and unknown options on their lines", async () => {
		const text = VALID.replace("size: small", "size: medium").replace(
			"type: clock",
			"type: monitor\n            stlye: compact",
		);
		const issues = await validateDraft(text, { configPath, glance: null });
		expect(issues).toEqual([
			{
				severity: "error",
				source: "layout",
				code: "invalid-column-size",
				params: { size: "medium" },
				message: 'Column size must be "small" or "full", not "medium"',
				path: ["pages", 0, "columns", 0],
				line: 4,
			},
			expect.objectContaining({
				severity: "warning",
				source: "glaze",
				line: 8,
				code: "unknown-option-suggestion",
				params: { key: "stlye", suggestion: "style" },
				fix: {
					kind: "rename-key",
					mapPath: ["pages", 0, "columns", 1, "widgets", 0],
					from: "stlye",
					to: "style",
				},
			}),
			{
				severity: "info",
				source: "glaze",
				code: "glance-validation-off",
				message: "Glance validation is off — set GLANCE_BIN",
			},
		]);
	});

	it("maps Glance's page/column numbers to a line", async () => {
		const issues = await validateDraft(`# fake: column-size\n${VALID}`, {
			configPath,
			glance: FAKE,
		});
		expect(issues).toEqual([
			expect.objectContaining({ source: "glance", line: 6 }),
		]);
	});
});
