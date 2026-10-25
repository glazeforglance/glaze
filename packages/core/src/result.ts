/** Outcome of an operation that can fail in an expected way. */
export type Result<T, E> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: E };

/**
 * Wraps a successful value.
 * @param value - The value to return.
 * @returns A successful `Result`.
 */
export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

/**
 * Wraps an expected failure.
 * @param error - The error describing what went wrong.
 * @returns A failed `Result`.
 */
export function err<E>(error: E): Result<never, E> {
	return { ok: false, error };
}
