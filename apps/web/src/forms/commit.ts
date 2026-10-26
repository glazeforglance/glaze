import { sameValue } from "./paths.ts";

/** What a field change should do to the document. */
export type CommitPlan =
	| { readonly kind: "none" }
	| { readonly kind: "set"; readonly value: unknown }
	| { readonly kind: "remove" };

/** Input for `planCommit`. */
export interface CommitInput {
	/** Value in the document now; `undefined` when the key isn't written. */
	readonly current: unknown;
	/** Value from the field. `""`, `null` and `undefined` mean "cleared". */
	readonly next: unknown;
	/** Glance's default for this option, when it has one. */
	readonly glanceDefault?: unknown;
}

function isCleared(value: unknown): boolean {
	return value === undefined || value === null || value === "";
}

/**
 * Decides how a field change is written, so the YAML only changes when the
 * meaning changes:
 * - a cleared field removes the key (never writes an empty string);
 * - an unchanged value writes nothing;
 * - Glance's default is not written for a key that isn't there yet.
 * @param input - Current and new value, plus Glance's default.
 * @returns The edit to make.
 */
export function planCommit({
	current,
	next,
	glanceDefault,
}: CommitInput): CommitPlan {
	if (isCleared(next)) {
		return current === undefined ? { kind: "none" } : { kind: "remove" };
	}
	if (sameValue(next, current)) return { kind: "none" };
	if (
		current === undefined &&
		glanceDefault !== undefined &&
		sameValue(next, glanceDefault)
	) {
		return { kind: "none" };
	}
	return { kind: "set", value: next };
}
