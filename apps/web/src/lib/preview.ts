import type { PageNode } from "@glaze/core";

/**
 * Turns a page name into a slug the way Glance v0.8.7 does (`titleToSlug` in
 * utils.go): lower case, runs of whitespace become `-`, dashes trimmed.
 * @param name - The page name.
 * @returns The slug.
 */
export function titleToSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Builds the preview URL for a page: Glance serves the first page at `/` and
 * every other page at `/<slug>`, using the page's `slug` or one made from its name.
 * @param glanceUrl - Base URL of Glance, without a trailing slash.
 * @param page - The page to show, or `null` for the first page.
 * @param index - Position of the page in `pages`.
 * @returns The URL for the iframe.
 */
export function previewUrl(
	glanceUrl: string,
	page: PageNode | null,
	index: number,
): string {
	if (!page || index <= 0) return `${glanceUrl}/`;
	const slug = page.slug ?? titleToSlug(page.name ?? "");
	return slug === ""
		? `${glanceUrl}/`
		: `${glanceUrl}/${encodeURIComponent(slug)}`;
}

/** How long Glance gets to notice the new file before we start checking. */
const SETTLE_MS = 600;
/** Without an answer from Glance, reload after this long anyway. */
export const FALLBACK_RELOAD_MS = 1500;
const POLL_INTERVAL_MS = 250;
const POLL_TIMEOUT_MS = 4000;

const sleep = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener("abort", () => {
			clearTimeout(timer);
			resolve();
		});
	});

/**
 * Waits until Glance has had time to reload a newly published config. Glance
 * reloads in-process when the file changes, so after a short pause this polls
 * `GET /api/healthz` until Glance answers. Glance sends no CORS headers, so the
 * request is `no-cors`: an opaque answer still proves Glance is up. When Glance
 * can't be reached at all, it falls back to a fixed delay.
 * @param glanceUrl - Base URL of Glance.
 * @param signal - Stops waiting (e.g. on unmount or a newer publish).
 * @param fetcher - `fetch`, replaceable in tests.
 * @returns Resolves when the preview can be reloaded.
 */
export async function waitForGlance(
	glanceUrl: string,
	signal: AbortSignal,
	fetcher: typeof fetch = fetch,
): Promise<void> {
	const started = Date.now();
	await sleep(SETTLE_MS, signal);
	let failures = 0;
	while (!signal.aborted && Date.now() - started < POLL_TIMEOUT_MS) {
		try {
			await fetcher(`${glanceUrl}/api/healthz`, {
				mode: "no-cors",
				cache: "no-store",
				signal,
			});
			return;
		} catch {
			failures += 1;
			// Unreachable from the browser: don't keep hammering, use the fixed delay.
			if (failures >= 2 && Date.now() - started >= FALLBACK_RELOAD_MS) return;
			await sleep(POLL_INTERVAL_MS, signal);
		}
	}
}

/** How long Glance gets to come back after a change to its `server` options. */
export const COMEBACK_TIMEOUT_MS = 8000;

/**
 * Checks whether Glance answers again after a publish, polling
 * `GET /api/healthz` (`no-cors`, like `waitForGlance`) until it answers or
 * the time is up. Unlike `waitForGlance` there is no early fallback: the
 * answer decides whether Glaze offers to undo the publish.
 * @param glanceUrl - Base URL of Glance.
 * @param signal - Stops checking (e.g. on unmount or a newer publish).
 * @param fetcher - `fetch`, replaceable in tests.
 * @param timeoutMs - How long to keep trying.
 * @returns True once Glance answers; false when it never did (or on abort).
 */
export async function glanceComesBack(
	glanceUrl: string,
	signal: AbortSignal,
	fetcher: typeof fetch = fetch,
	timeoutMs = COMEBACK_TIMEOUT_MS,
): Promise<boolean> {
	const started = Date.now();
	await sleep(SETTLE_MS, signal);
	while (!signal.aborted && Date.now() - started < timeoutMs) {
		try {
			await fetcher(`${glanceUrl}/api/healthz`, {
				mode: "no-cors",
				cache: "no-store",
				signal,
			});
			return !signal.aborted;
		} catch {
			await sleep(POLL_INTERVAL_MS, signal);
		}
	}
	return false;
}
