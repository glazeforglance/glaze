// Takes the README screenshots of the built app with the demo config in
// docs/screenshots/demo/glance.yml and writes them to docs/screenshots/.
//
//   pnpm build                                 (the script uses the production build)
//   pnpm exec playwright install chromium      (once)
//   pnpm screenshots
//   GLANCE_BIN=/path/to/glance pnpm screenshots   (adds the live preview shot)
//   pnpm screenshots --locale rtl-test            (editor, inspector and Settings
//                                                  in one UI language, to .dev/screenshots/<locale>/)
//
// Every edit happens in the browser; the demo config is copied to a temp
// folder, so nothing on disk changes. Runs on plain Node (built-in type
// stripping), so only erasable TypeScript here.

import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEMO_CONFIG = join(ROOT, "docs/screenshots/demo/glance.yml");
const OUT = join(ROOT, "docs/screenshots");
const SERVER = join(ROOT, "apps/server/dist/index.js");
const WEB_DIST = join(ROOT, "apps/web/dist");
const GLANCE_PORT = 8080;
const VIEWPORT = { width: 1440, height: 900 };
// 1× keeps each PNG well under 400 KB; GitHub shows the README at about this width anyway.
const DEVICE_SCALE_FACTOR = 1;
const STARTUP_TIMEOUT_MS = 20_000;

// No blinking caret, no transitions: the same UI gives the same image.
const STABLE_CSS = `
	*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }
	.cm-cursorLayer, .cm-cursor { display: none !important; }
`;

const children: ChildProcess[] = [];
let stopping = false;

function fail(message: string): never {
	console.error(`✗ ${message}`);
	stopping = true;
	for (const child of children) child.kill();
	process.exit(1);
}

/** Stops the servers and waits until they're gone (Windows keeps their files locked until then). */
async function stopChildren(): Promise<void> {
	stopping = true;
	await Promise.all(
		children.map(
			(child) =>
				new Promise<void>((resolveExit) => {
					if (child.exitCode !== null || child.signalCode !== null)
						return resolveExit();
					child.once("exit", () => resolveExit());
					child.kill();
				}),
		),
	);
}

function freePort(): Promise<number> {
	return new Promise((resolvePort, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, () => {
			const address = server.address();
			const port =
				typeof address === "object" && address !== null ? address.port : 0;
			server.close(() => resolvePort(port));
		});
	});
}

function portIsFree(port: number): Promise<boolean> {
	return new Promise((resolveFree) => {
		const server = createServer();
		server.once("error", () => resolveFree(false));
		server.listen(port, () => server.close(() => resolveFree(true)));
	});
}

async function waitForUrl(url: string, name: string): Promise<void> {
	const deadline = Date.now() + STARTUP_TIMEOUT_MS;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(url);
			if (response.ok) return;
		} catch {
			// Not listening yet.
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	fail(`${name} didn't answer on ${url} within ${STARTUP_TIMEOUT_MS / 1000} s`);
}

function start(
	name: string,
	command: string,
	args: string[],
	env: NodeJS.ProcessEnv,
): void {
	const child = spawn(command, args, {
		cwd: ROOT,
		env,
		stdio: ["ignore", "pipe", "pipe"],
	});
	let output = "";
	child.stdout?.on("data", (chunk: Buffer) => {
		output += chunk.toString();
	});
	child.stderr?.on("data", (chunk: Buffer) => {
		output += chunk.toString();
	});
	child.on("exit", (code) => {
		if (!stopping && code !== null && code !== 0)
			fail(`${name} exited with code ${code}:\n${output}`);
	});
	children.push(child);
}

/**
 * Starts a Glaze server. Every setting Glaze reads is set explicitly, because
 * the server also loads the repo's `.env`, which never overrides existing variables.
 */
async function startGlaze(options: {
	configPath: string;
	passwordHash: string | null;
	glanceBin: string | null;
	glanceUrl: string | null;
}): Promise<string> {
	const port = await freePort();
	start("Glaze", process.execPath, [SERVER], {
		...process.env,
		NODE_ENV: "development",
		GLAZE_AUTH: options.passwordHash === null ? "off" : "on",
		GLAZE_ADMIN_USERNAME: "admin",
		GLAZE_ADMIN_PASSWORD_HASH: options.passwordHash ?? "",
		GLAZE_ADMIN_PASSWORD: "",
		GLAZE_ADMIN_PASSWORD_HASH_FILE: "",
		GLAZE_ADMIN_PASSWORD_FILE: "",
		GLAZE_SECRET: randomBytes(32).toString("base64url"),
		GLAZE_SECRET_FILE: "",
		GLAZE_TRUST_PROXY: "",
		GLAZE_CONFIG_PATH: options.configPath,
		GLAZE_PORT: String(port),
		GLAZE_ASSETS_PATH: "",
		GLAZE_WEB_DIST: WEB_DIST,
		GLANCE_BIN: options.glanceBin ?? "",
		GLANCE_URL: options.glanceUrl ?? "",
	});
	const url = `http://localhost:${port}`;
	await waitForUrl(`${url}/api/healthz`, "Glaze");
	return url;
}

/** A random hash in the `scrypt:N:r:p:salt:hash` format: nobody knows a password for it. */
function unusableHash(): string {
	return `scrypt:32768:8:1:${randomBytes(16).toString("base64url")}:${randomBytes(32).toString("base64url")}`;
}

/** With `--locale`: the UI language to start in (saved choice, as the picker stores it). */
const LOCALE = (() => {
	const index = process.argv.indexOf("--locale");
	return index === -1 ? null : (process.argv[index + 1] ?? null);
})();

async function openPage(browser: Browser, url: string): Promise<Page> {
	const context = await browser.newContext({
		viewport: VIEWPORT,
		deviceScaleFactor: DEVICE_SCALE_FACTOR,
		colorScheme: "dark",
		reducedMotion: "reduce",
		// Only so the stabilising style tag may load; the app keeps its strict CSP.
		bypassCSP: true,
	});
	if (LOCALE !== null) {
		await context.addInitScript((language: string) => {
			localStorage.setItem("glaze.language", language);
		}, LOCALE);
	}
	const page = await context.newPage();
	await page.goto(url);
	await page.addStyleTag({ content: STABLE_CSS });
	return page;
}

async function settle(page: Page): Promise<void> {
	await page.waitForLoadState("networkidle");
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	// One more frame for layout after fonts swap in.
	await page.waitForTimeout(300);
}

async function shoot(page: Page, name: string, folder = OUT): Promise<void> {
	await settle(page);
	await page.screenshot({ path: join(folder, name) });
	console.log(`✓ ${relative(ROOT, join(folder, name)).replaceAll("\\", "/")}`);
}

/**
 * Editor, inspector and Settings in one UI language, for checking layouts
 * (long labels, right-to-left). Uses no translated names to find things:
 * page and widget titles come from the demo config, views from Ctrl+1–4.
 */
async function localeShots(browser: Browser, url: string, locale: string) {
	const folder = join(ROOT, ".dev/screenshots", locale);
	mkdirSync(folder, { recursive: true });
	const page = await openEditor(browser, url);
	await page.getByRole("tab", { name: "Homelab", exact: true }).click();
	await shoot(page, "editor.png", folder);
	await page.getByRole("button", { name: /^Services monitor/ }).click();
	await page.locator("#inspector-panel-settings").waitFor();
	await shoot(page, "inspector.png", folder);
	await page.keyboard.press("Control+4");
	await page.locator("nav").first().waitFor();
	await shoot(page, "settings.png", folder);
	await page.context().close();
}

async function openEditor(browser: Browser, url: string): Promise<Page> {
	const page = await openPage(browser, url);
	await page.getByRole("tab", { name: "Home", exact: true }).waitFor();
	return page;
}

/** Opens the Homelab page (three columns) and selects its Services monitor. */
async function selectMonitor(page: Page): Promise<void> {
	await page.getByRole("tab", { name: "Homelab", exact: true }).click();
	await page
		.getByRole("button", { name: "Services monitor", exact: true })
		.click();
	await page
		.getByRole("complementary", { name: "Inspector" })
		.getByText("Sites")
		.first()
		.waitFor();
}

async function editorShot(browser: Browser, url: string): Promise<void> {
	const page = await openEditor(browser, url);
	await selectMonitor(page);
	await shoot(page, "editor.png");
	await page.context().close();
}

async function codePreviewShot(browser: Browser, url: string): Promise<void> {
	const page = await openEditor(browser, url);
	await page.getByRole("button", { name: "Code", exact: true }).click();
	const preview = page.getByRole("region", { name: "Live preview" });
	if (!(await preview.isVisible()))
		await page.getByRole("button", { name: "Show preview" }).click();
	await page.frameLocator("iframe").locator("body").waitFor();
	// Glance loads widget data after the page itself; give icons and lists time to arrive.
	await page.waitForTimeout(3000);
	await shoot(page, "code-preview.png");
	await page.context().close();
}

async function validationShot(browser: Browser, url: string): Promise<void> {
	const page = await openEditor(browser, url);
	await page.getByRole("button", { name: "Code", exact: true }).click();
	const hide = page.getByRole("button", { name: "Hide preview" });
	if (await hide.isVisible()) await hide.click();
	// Make the typo by typing, like a person would: only the browser's draft changes.
	// CodeMirror only renders visible lines, so find the line with its own search.
	await page.locator(".cm-content").click();
	await page.keyboard.press("Control+f");
	await page.keyboard.type("style: compact");
	await page.keyboard.press("Enter");
	await page.keyboard.press("Escape");
	await page.keyboard.type("stlye: compact");
	await page.getByRole("button", { name: /^Fix: rename stlye/ }).waitFor();
	// Jump from the problem to its line: centres it, like clicking the problem does.
	await page
		.getByRole("region", { name: "Problems" })
		.getByRole("button", { name: /Unknown option/ })
		.click();
	await shoot(page, "validation.png");
	await page.context().close();
}

async function publishShot(browser: Browser, url: string): Promise<void> {
	const page = await openEditor(browser, url);
	await selectMonitor(page);
	const title = page
		.getByRole("complementary", { name: "Inspector" })
		.getByLabel("Title", { exact: true })
		.first();
	await title.fill("Home services");
	await title.press("Tab");
	await page.getByRole("button", { name: "Publish", exact: true }).click();
	await page
		.getByRole("dialog")
		.getByRole("region", { name: "Files that change" })
		.waitFor();
	await shoot(page, "publish.png");
	await page.context().close();
}

/** Opens the Status page, whose full column has a split-column with three widgets. */
async function openStatusPage(page: Page): Promise<void> {
	await page.getByRole("tab", { name: "Status", exact: true }).click();
	await page.getByText("Solar today", { exact: true }).waitFor();
}

async function splitColumnShot(browser: Browser, url: string): Promise<void> {
	const page = await openEditor(browser, url);
	await openStatusPage(page);
	await page.getByText("Server stats", { exact: true }).last().click();
	const handle = page.getByRole("slider", { name: "Width of Server stats" });
	await handle.waitFor();
	// Hold the handle without moving it far: the label (⅓ · 3 columns) and the
	// shared-width hint only show while dragging. Released afterwards on the
	// same width, so nothing changes.
	const box = await handle.boundingBox();
	if (box === null) fail("The width handle has no size");
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + 4, y, { steps: 2 });
	await shoot(page, "split-column.png");
	await page.mouse.up();
	await page.context().close();
}

async function customApiShot(browser: Browser, url: string): Promise<void> {
	const page = await openEditor(browser, url);
	await openStatusPage(page);
	await page.getByText("Solar today", { exact: true }).click();
	// The widest inspector, so the template lines don't wrap as much, and no
	// library, so the canvas keeps its room.
	await page.getByRole("separator", { name: "Resize the inspector" }).focus();
	await page.keyboard.press("End");
	await page.getByRole("button", { name: "Hide the widget library" }).click();
	const inspector = page.getByRole("complementary", { name: "Inspector" });
	const cheatSheet = inspector.getByText("Template cheat sheet");
	await cheatSheet.click();
	// Template and cheat sheet together, below the request fields.
	await inspector
		.getByText("Template", { exact: true })
		.first()
		.evaluate((element) => element.scrollIntoView({ block: "start" }));
	await shoot(page, "custom-api.png");
	await page.context().close();
}

async function settingsShot(browser: Browser, url: string): Promise<void> {
	const page = await openEditor(browser, url);
	await page.getByRole("button", { name: /^Settings/ }).click();
	await page
		.getByRole("navigation", { name: "Settings sections" })
		.getByRole("button", { name: "Theme", exact: true })
		.click();
	await page.getByRole("heading", { name: "Theme", exact: true }).waitFor();
	await shoot(page, "settings.png");
	await page.context().close();
}

async function loginShot(browser: Browser, url: string): Promise<void> {
	const page = await openPage(browser, url);
	await page
		.getByRole("button", { name: /log in/i })
		.first()
		.waitFor();
	await shoot(page, "login.png");
	await page.context().close();
}

async function main(): Promise<void> {
	if (!existsSync(SERVER) || !existsSync(join(WEB_DIST, "index.html"))) {
		fail("No production build found. Run `pnpm build` first.");
	}
	mkdirSync(OUT, { recursive: true });
	const temp = mkdtempSync(join(tmpdir(), "glaze-screenshots-"));
	const copy = (name: string): string => {
		const folder = join(temp, name);
		mkdirSync(folder);
		copyFileSync(DEMO_CONFIG, join(folder, "glance.yml"));
		return join(folder, "glance.yml");
	};

	const rawGlanceBin = process.env.GLANCE_BIN?.trim();
	const glanceBin = rawGlanceBin
		? isAbsolute(rawGlanceBin)
			? rawGlanceBin
			: resolve(ROOT, rawGlanceBin)
		: null;
	let glanceUrl: string | null = null;
	if (glanceBin !== null) {
		if (!(await portIsFree(GLANCE_PORT)))
			fail(`Port ${GLANCE_PORT} is in use; Glance needs it for the preview`);
		start("Glance", glanceBin, ["--config", copy("glance")], {
			...process.env,
			// The demo config reads these; empty means unauthenticated GitHub
			// requests and failing (fake) homelab requests.
			GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? "",
			PIHOLE_PASSWORD: "",
			SOLAR_API_KEY: "",
		});
		glanceUrl = `http://localhost:${GLANCE_PORT}`;
		await waitForUrl(`${glanceUrl}/api/healthz`, "Glance");
	} else {
		console.log(
			"· GLANCE_BIN isn't set: skipping code-preview.png (no live preview)",
		);
	}

	const editorUrl = await startGlaze({
		configPath: copy("editor"),
		passwordHash: null,
		glanceBin,
		glanceUrl,
	});
	const loginUrl = await startGlaze({
		configPath: copy("login"),
		passwordHash: unusableHash(),
		glanceBin: null,
		glanceUrl: null,
	});

	const browser = await chromium.launch();
	try {
		if (LOCALE !== null) {
			await localeShots(browser, editorUrl, LOCALE);
			return;
		}
		await editorShot(browser, editorUrl);
		if (glanceUrl !== null) await codePreviewShot(browser, editorUrl);
		await validationShot(browser, editorUrl);
		await publishShot(browser, editorUrl);
		await splitColumnShot(browser, editorUrl);
		await customApiShot(browser, editorUrl);
		await settingsShot(browser, editorUrl);
		await loginShot(browser, loginUrl);
	} finally {
		await browser.close();
		await stopChildren();
		rmSync(temp, { recursive: true, force: true });
	}
}

main().catch((error: unknown) =>
	fail(error instanceof Error ? (error.stack ?? error.message) : String(error)),
);
