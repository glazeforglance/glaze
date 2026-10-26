import { useState } from "react";

/**
 * Turns true the first time `value` is true and stays true afterwards,
 * e.g. to mount a panel on first use and keep it mounted.
 * @param value - The changing condition.
 * @returns Whether `value` has ever been true.
 */
export function useOnceTrue(value: boolean): boolean {
	const [seen, setSeen] = useState(value);
	// Updating state during render is React's documented way to derive from a changing prop.
	if (value && !seen) setSeen(true);
	return seen || value;
}
