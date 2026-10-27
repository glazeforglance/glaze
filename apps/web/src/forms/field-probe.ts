import { createContext, useContext } from "react";

/**
 * Records which options a rendered form shows. Only tests provide one (the
 * coverage test renders every widget form with it); in the app it is `null`
 * and costs nothing.
 */
export interface FieldProbe {
	/** Form field names that were rendered, e.g. `sites.0.url`. */
	readonly seen: Set<string>;
}

export const FieldProbeContext = createContext<FieldProbe | null>(null);

/**
 * Notes that a field is shown, when a probe is listening.
 * @param name - The field's form name.
 * @returns Whether a probe is listening (lists and maps then open every item).
 */
export function useFieldProbe(name: string): boolean {
	const probe = useContext(FieldProbeContext);
	probe?.seen.add(name);
	return probe !== null;
}
