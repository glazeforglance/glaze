import { createContext, useContext } from "react";

/** A hand-made control that replaces a generated one (see `SchemaField`). */
export type CustomField = "container-labels" | "template";

/**
 * Options where a hand-made control is clearly better than the generated one,
 * per widget type and top-level option:
 * - docker-containers `containers`: Glance's container labels (name, url,
 *   icon, …) have names the Go source doesn't list (it is a plain map);
 * - custom-api `template`: the editor plus a cheat sheet of template functions.
 */
const CUSTOM_FIELDS: Readonly<
	Record<string, Readonly<Record<string, CustomField>>>
> = {
	"docker-containers": { containers: "container-labels" },
	"custom-api": { template: "template" },
};

/** The widget type of the form being rendered, for `useCustomField`. */
export const WidgetTypeContext = createContext<string | null>(null);

/**
 * Looks up a hand-made control for an option of the current widget.
 * @param name - The field's form name; only top-level options are replaced.
 * @returns Which control, or `null` to use the generated one.
 */
export function useCustomField(name: string): CustomField | null {
	const type = useContext(WidgetTypeContext);
	if (type === null || !Object.hasOwn(CUSTOM_FIELDS, type)) return null;
	const fields = CUSTOM_FIELDS[type] ?? {};
	return Object.hasOwn(fields, name) ? (fields[name] ?? null) : null;
}
