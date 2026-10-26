/** Whether another attempt is allowed right now. */
export type RateLimitCheck =
	| { readonly allowed: true }
	| { readonly allowed: false; readonly retryAfterSeconds: number };

/** Counts failed attempts per key (e.g. per IP) in a sliding window. */
export interface RateLimiter {
	/** Tells whether `key` may try again. */
	check(key: string): RateLimitCheck;
	/** Records a failed attempt for `key`. */
	fail(key: string): void;
	/** Forgets `key`'s failures, e.g. after a successful login. */
	reset(key: string): void;
	/** Number of keys currently tracked (for tests). */
	size(): number;
}

/** Settings for `createRateLimiter`. */
export interface RateLimitOptions {
	/** Failed attempts allowed per window. */
	readonly max: number;
	readonly windowMs: number;
	/** Clock, replaceable in tests. */
	readonly now?: () => number;
}

/**
 * Creates an in-memory rate limiter. Each key keeps the times of its recent
 * failures; once `max` of them fall inside the window, further attempts are
 * refused until the oldest one expires. Expired entries are swept on every
 * call (at most once per window), so the map can't grow without bound.
 * @param options - Limit, window and clock.
 * @returns The limiter.
 */
export function createRateLimiter(options: RateLimitOptions): RateLimiter {
	const { max, windowMs } = options;
	const now = options.now ?? Date.now;
	const failures = new Map<string, number[]>();
	let lastSweep = now();

	const recent = (key: string, time: number): number[] => {
		const kept = (failures.get(key) ?? []).filter((t) => t > time - windowMs);
		if (kept.length === 0) failures.delete(key);
		else failures.set(key, kept);
		return kept;
	};

	const sweep = (time: number) => {
		if (time - lastSweep < windowMs) return;
		lastSweep = time;
		for (const key of [...failures.keys()]) recent(key, time);
	};

	return {
		check(key) {
			const time = now();
			sweep(time);
			const times = recent(key, time);
			if (times.length < max) return { allowed: true };
			// Allowed again once the oldest failure that still counts drops out.
			const oldest = times[times.length - max] ?? time;
			return {
				allowed: false,
				retryAfterSeconds: Math.max(
					1,
					Math.ceil((oldest + windowMs - time) / 1000),
				),
			};
		},
		fail(key) {
			const time = now();
			failures.set(key, [...recent(key, time), time]);
		},
		reset(key) {
			failures.delete(key);
		},
		size: () => failures.size,
	};
}
