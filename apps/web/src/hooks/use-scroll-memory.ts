import { type RefObject, useLayoutEffect, useRef } from "react";

/** What `useScrollMemory` gives the scrolling element. */
export interface ScrollMemory<T extends HTMLElement> {
	readonly ref: RefObject<T | null>;
	readonly onScroll: () => void;
}

/**
 * Remembers an element's scroll position per key and restores it when the key
 * comes back, e.g. the inspector for a widget that is selected again.
 * Edits don't change the key, so they never move the scroll position.
 * @param key - What is shown, e.g. `widget-7:settings`; `null` scrolls to the top.
 * @returns A ref and a scroll handler for the scrolling element.
 */
export function useScrollMemory<T extends HTMLElement>(
	key: string | null,
): ScrollMemory<T> {
	const ref = useRef<T | null>(null);
	const positions = useRef(new Map<string, number>());

	// Layout effect: restore before the browser paints, so nothing jumps.
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		element.scrollTop = key === null ? 0 : (positions.current.get(key) ?? 0);
	}, [key]);

	return {
		ref,
		onScroll: () => {
			if (key !== null && ref.current) {
				positions.current.set(key, ref.current.scrollTop);
			}
		},
	};
}
