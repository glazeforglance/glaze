import type { PageNode } from "@glaze/core";
import { describe, expect, it, vi } from "vitest";
import { previewUrl, titleToSlug, waitForGlance } from "../src/lib/preview.ts";

function page(name: string, slug: string | null = null): PageNode {
	return {
		id: "page-1",
		path: ["pages", 0],
		name,
		slug,
		width: null,
		include: null,
		headWidgets: [],
		columns: [],
	};
}

describe("titleToSlug", () => {
	it("follows Glance: lower case, whitespace to dashes, trimmed", () => {
		expect(titleToSlug("Home Lab")).toBe("home-lab");
		expect(titleToSlug("  Media   &  News ")).toBe("media-&-news");
		expect(titleToSlug("Ünïcode")).toBe("ünïcode");
	});
});

describe("previewUrl", () => {
	const base = "http://localhost:8080";

	it("uses / for the first page", () => {
		expect(previewUrl(base, page("Home", "home"), 0)).toBe(`${base}/`);
		expect(previewUrl(base, null, -1)).toBe(`${base}/`);
	});

	it("uses the slug, or one made from the name", () => {
		expect(previewUrl(base, page("Server", "srv"), 1)).toBe(`${base}/srv`);
		expect(previewUrl(base, page("Home Lab"), 2)).toBe(`${base}/home-lab`);
		expect(previewUrl(base, page("Media & News"), 2)).toBe(
			`${base}/media-%26-news`,
		);
	});
});

describe("waitForGlance", () => {
	it("polls /api/healthz without CORS and resolves once Glance answers", async () => {
		vi.useFakeTimers();
		const fetcher = vi
			.fn<typeof fetch>()
			.mockRejectedValueOnce(new TypeError("down"))
			.mockResolvedValue(new Response(null, { status: 200 }));
		const done = waitForGlance(
			"http://g",
			new AbortController().signal,
			fetcher,
		);
		await vi.runAllTimersAsync();
		await done;
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(fetcher.mock.calls[0]?.[0]).toBe("http://g/api/healthz");
		expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ mode: "no-cors" });
		vi.useRealTimers();
	});

	it("gives up and resolves when Glance can't be reached", async () => {
		vi.useFakeTimers();
		const fetcher = vi
			.fn<typeof fetch>()
			.mockRejectedValue(new TypeError("down"));
		const done = waitForGlance(
			"http://g",
			new AbortController().signal,
			fetcher,
		);
		await vi.runAllTimersAsync();
		await expect(done).resolves.toBeUndefined();
		expect(fetcher.mock.calls.length).toBeLessThan(10);
		vi.useRealTimers();
	});

	it("stops when aborted", async () => {
		const controller = new AbortController();
		const fetcher = vi.fn<typeof fetch>();
		controller.abort();
		await waitForGlance("http://g", controller.signal, fetcher);
		expect(fetcher).not.toHaveBeenCalled();
	});
});
