import { createContext, useContext } from "react";
import type { ListKind } from "../../lib/drop-target.ts";

/**
 * The kind of list a widget is drawn in. Containers use it to decide whether
 * their children are a drop list too: in head widgets they are only shown.
 */
export const ListKindContext = createContext<ListKind | null>(null);

/**
 * Reads the kind of list the component is rendered in.
 * @returns The list kind, or `null` outside any list.
 */
export function useListKind(): ListKind | null {
	return useContext(ListKindContext);
}
