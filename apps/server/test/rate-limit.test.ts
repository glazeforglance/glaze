import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../src/rate-limit.ts";

function limiter() {
	let time = 0;
	const rate = createRateLimiter({
		max: 5,
		windowMs: 5 * 60_000,
		now: () => time,
	});
	return {
		rate,
		advance: (ms: number) => {
			time += ms;
		},
	};
}

describe("createRateLimiter", () => {
	it("allows 5 failures, then refuses with the seconds to wait", () => {
		const { rate, advance } = limiter();
		for (let i = 0; i < 5; i++) {
			expect(rate.check("1.2.3.4").allowed).toBe(true);
			rate.fail("1.2.3.4");
			advance(10_000);
		}
		// First failure was at 0; it drops out at 300 s, now is 50 s.
		expect(rate.check("1.2.3.4")).toEqual({
			allowed: false,
			retryAfterSeconds: 250,
		});
		expect(rate.check("5.6.7.8").allowed).toBe(true);
	});

	it("allows again once the window has passed", () => {
		const { rate, advance } = limiter();
		for (let i = 0; i < 5; i++) rate.fail("ip");
		expect(rate.check("ip").allowed).toBe(false);
		advance(5 * 60_000);
		expect(rate.check("ip").allowed).toBe(true);
	});

	it("forgets a key after reset", () => {
		const { rate } = limiter();
		for (let i = 0; i < 5; i++) rate.fail("ip");
		rate.reset("ip");
		expect(rate.check("ip").allowed).toBe(true);
	});

	it("cleans up expired entries", () => {
		const { rate, advance } = limiter();
		for (let i = 0; i < 100; i++) rate.fail(`ip-${i}`);
		expect(rate.size()).toBe(100);
		advance(6 * 60_000);
		rate.check("someone-else");
		expect(rate.size()).toBe(0);
	});
});
