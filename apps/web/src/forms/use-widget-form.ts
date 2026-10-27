import {
	type EnvReference,
	getMapOptions,
	getWidgetOptions,
	type WidgetNode,
	type WidgetOption,
	type YamlPath,
} from "@glaze/core";
import { createContext, useContext } from "react";
import {
	type ControllerRenderProps,
	type FieldValues,
	type UseFormReturn,
	useController,
	useWatch,
} from "react-hook-form";
import type { z } from "zod";
import { findWidget } from "../lib/model.ts";
import { editorStore, selectCurrentPage } from "../store/editor-store.ts";
import { planCommit } from "./commit.ts";
import { useFieldProbe } from "./field-probe.ts";
import { toSubPath, valueAt } from "./paths.ts";
import { validateField } from "./validate.ts";

/**
 * What a form edits: a widget, or another map in the document (a page, or
 * the document root for the Settings view). Fields read and write through it,
 * so the same field components work everywhere.
 */
export interface FormTarget {
	/** The current values, read from the store right now (not from the last render). */
	values(): Record<string, unknown> | null;
	/** Sets a value at a path below the target, e.g. `["sites", 2, "url"]`. */
	set(path: YamlPath, value: unknown): boolean;
	remove(path: YamlPath): boolean;
	insert(listPath: YamlPath, value: unknown, index?: number): boolean;
	move(listPath: YamlPath, fromIndex: number, toIndex: number): boolean;
	/** Renames a key of the map at `mapPath`, keeping its value and comments. */
	rename(mapPath: YamlPath, from: string, to: string): boolean;
}

/**
 * A form target for a widget of the current page. Widget ids survive edits,
 * so the widget is looked up again for every read and write.
 * @param widgetId - The widget's Glaze id.
 * @returns The target.
 */
export function widgetTarget(widgetId: string): FormTarget {
	const store = () => editorStore.getState();
	return {
		values: () => {
			const state = store();
			const page = selectCurrentPage(state);
			const widget = page ? findWidget(page, widgetId) : null;
			if (!state.doc || !widget) return null;
			const options = getWidgetOptions(state.doc, widget.path);
			return options.ok ? optionValues(options.value.options) : null;
		},
		set: (path, value) => {
			const [key] = path;
			return path.length === 1 && typeof key === "string"
				? store().setWidgetOption(widgetId, key, value)
				: store().setWidgetValue(widgetId, path, value);
		},
		remove: (path) => {
			const [key] = path;
			return path.length === 1 && typeof key === "string"
				? store().removeWidgetOption(widgetId, key)
				: store().removeWidgetValue(widgetId, path);
		},
		insert: (listPath, value, index) =>
			store().insertWidgetListItem(widgetId, listPath, value, index),
		move: (listPath, fromIndex, toIndex) =>
			store().moveWidgetListItem(widgetId, listPath, fromIndex, toIndex),
		rename: (mapPath, from, to) => {
			const page = selectCurrentPage(store());
			const widget = page ? findWidget(page, widgetId) : null;
			return widget
				? store().renameKey([...widget.path, ...mapPath], from, to)
				: false;
		},
	};
}

/**
 * A form target for a page or the document root.
 * @param basePath - Returns the map's path now (a page's path changes when pages move), or `null` when it's gone.
 * @returns The target.
 */
export function mapTarget(basePath: () => YamlPath | null): FormTarget {
	const store = () => editorStore.getState();
	const withBase = (edit: (base: YamlPath) => boolean): boolean => {
		const base = basePath();
		return base === null ? false : edit(base);
	};
	return {
		values: () => {
			const { doc } = store();
			const base = basePath();
			if (!doc || base === null) return null;
			const options = getMapOptions(doc, base);
			return options.ok ? optionValues(options.value.options) : null;
		},
		set: (path, value) =>
			withBase((base) => store().setValueAt(base, path, value)),
		remove: (path) => withBase((base) => store().removeValueAt(base, path)),
		insert: (listPath, value, index) =>
			withBase((base) =>
				store().insertListItemAt(base, listPath, value, index),
			),
		move: (listPath, fromIndex, toIndex) =>
			withBase((base) =>
				store().moveListItemAt(base, listPath, fromIndex, toIndex),
			),
		rename: (mapPath, from, to) =>
			withBase((base) => store().renameKey([...base, ...mapPath], from, to)),
	};
}

/** Everything the fields of one form share. */
export interface WidgetFormApi {
	/** The widget being edited, or `null` for a page or settings form. */
	readonly widget: WidgetNode | null;
	readonly target: FormTarget;
	readonly schema: z.ZodType;
	readonly options: ReadonlyMap<string, WidgetOption>;
	/** True for alias widgets: every field is shown but can't be changed. */
	readonly readOnly: boolean;
	readonly form: UseFormReturn<FieldValues>;
	/** Type of the group / split-column this widget is in, or `null` in a column. */
	readonly parentType: string | null;
	/** Shared `widgetBase` fields that don't apply here (see `BaseFields`). */
	readonly hiddenBaseFields: ReadonlySet<BaseFieldKey>;
}

/** The options every widget has (Glance's `widgetBase`). */
export type BaseFieldKey =
	| "title"
	| "title-url"
	| "cache"
	| "hide-header"
	| "css-class";

/** Provided by `WidgetForm`; read with `useWidgetForm`. */
export const WidgetFormContext = createContext<WidgetFormApi | null>(null);

/**
 * Returns the widget form the component is rendered in.
 * @returns The form API.
 */
export function useWidgetForm(): WidgetFormApi {
	const api = useContext(WidgetFormContext);
	if (!api) throw new Error("useWidgetForm must be used inside a WidgetForm");
	return api;
}

/**
 * Turns options into plain form values: `{ title: "…", sites: [...] }`.
 * @param options - The widget's options from `getWidgetOptions`.
 * @returns One entry per option.
 */
export function optionValues(
	options: ReadonlyMap<string, WidgetOption>,
): Record<string, unknown> {
	return Object.fromEntries(
		[...options].map(([key, option]) => [key, option.value]),
	);
}

/** Where a field's top-level option comes from. */
export type FieldStatus = "own" | "inherited" | "unset";

/** Rules that decide what a field writes. */
export interface FieldRules {
	/** Glance's default: not written while the key isn't in the file yet. */
	readonly glanceDefault?: unknown;
}

/** What a field component needs. */
export interface WidgetField {
	readonly field: ControllerRenderProps<FieldValues, string>;
	readonly path: YamlPath;
	readonly error: string | undefined;
	readonly status: FieldStatus;
	/** `${...}` references in the option this field belongs to, at this field. */
	readonly env: readonly EnvReference[];
	/** True when the field can't be changed (read-only form, or an inherited value). */
	readonly disabled: boolean;
	/** True when the whole form is read-only (an alias widget). */
	readonly readOnly: boolean;
	/** Validates and writes the field (or `value`, when given). Returns whether it was applied. */
	commit(value?: unknown): boolean;
	/** Drops an uncommitted change and shows the document's value again. */
	cancel(): void;
	/** Copies the inherited value onto the widget, so it can be edited. */
	override(): void;
}

/**
 * Connects one form field to the document: reading, validating with the
 * widget's Zod schema, and writing through the editor store.
 * @param name - Field name, e.g. `title` or `sites.2.url`.
 * @param rules - What to write (see `FieldRules`).
 * @returns The field's state and actions.
 */
export function useWidgetField(
	name: string,
	rules: FieldRules = {},
): WidgetField {
	const { target, schema, options, readOnly, form } = useWidgetForm();
	useFieldProbe(name);
	const { field, fieldState } = useController({ name, control: form.control });
	const path = toSubPath(name);
	const [key] = path;
	const option = typeof key === "string" ? options.get(key) : undefined;
	const status: FieldStatus = option
		? option.source === "own"
			? "own"
			: "inherited"
		: "unset";
	const below = path.slice(1);
	const env =
		option?.env.filter(
			(reference) => JSON.stringify(reference.path) === JSON.stringify(below),
		) ?? [];

	const commit = (value: unknown = form.getValues(name)): boolean => {
		const values = target.values();
		if (!values || typeof key !== "string") return false;
		const message = validateField(schema, values, path, value);
		if (message !== null) {
			form.setError(name, { type: "validate", message });
			return false;
		}
		form.clearErrors(name);
		const plan = planCommit({
			current: valueAt(values, path),
			next: value,
			glanceDefault: rules.glanceDefault,
		});
		if (plan.kind === "none") return true;
		const applied =
			plan.kind === "set" ? target.set(path, plan.value) : target.remove(path);
		if (!applied) {
			// Show the document's value again, and why the edit was refused right
			// at the field (the canvas notice may be out of view).
			form.resetField(name);
			const notice = editorStore.getState().notice;
			if (notice) form.setError(name, { type: "refused", message: notice });
		}
		return applied;
	};

	return {
		field,
		path,
		error: fieldState.error?.message,
		status,
		env,
		disabled: readOnly || status === "inherited",
		readOnly,
		commit,
		cancel: () => {
			form.resetField(name);
			form.clearErrors(name);
		},
		override: () => {
			if (!option || typeof key !== "string") return;
			target.set([key], option.value);
		},
	};
}

/** What a list editor needs. */
export interface WidgetList {
	readonly items: readonly unknown[];
	readonly path: YamlPath;
	readonly status: FieldStatus;
	readonly disabled: boolean;
	/** True while a test probe renders the form: show every item, open. */
	readonly expandAll: boolean;
	readonly readOnly: boolean;
	add(value: unknown, index?: number): boolean;
	remove(index: number): boolean;
	move(fromIndex: number, toIndex: number): boolean;
	override(): void;
}

/**
 * Connects a list option (e.g. monitor `sites`) to the document. Items are
 * edited in place with the nested edits from `@glaze/core`, so comments and
 * the formatting of the other items stay as they are.
 * @param name - Field name of the list, e.g. `sites` or `groups.0.links`.
 * @returns The items and list actions.
 */
export function useWidgetList(name: string): WidgetList {
	const { target, options, readOnly, form } = useWidgetForm();
	const watched: unknown = useWatch({ control: form.control, name });
	const probing = useFieldProbe(name);
	const items = Array.isArray(watched) ? watched : [];
	const path = toSubPath(name);
	const [key] = path;
	const option = typeof key === "string" ? options.get(key) : undefined;
	const status: FieldStatus = option
		? option.source === "own"
			? "own"
			: "inherited"
		: "unset";

	return {
		items,
		path,
		status,
		disabled: readOnly || status === "inherited",
		readOnly,
		expandAll: probing,
		add: (value, index) => target.insert(path, value, index),
		// Removing the last item removes the key, instead of leaving `sites:` empty.
		remove: (index) =>
			target.remove(items.length === 1 ? path : [...path, index]),
		move: (fromIndex, toIndex) => target.move(path, fromIndex, toIndex),
		override: () => {
			if (!option || typeof key !== "string") return;
			target.set([key], option.value);
		},
	};
}

/** What a map editor needs. */
export interface WidgetMap {
	/** Entries in file order. */
	readonly entries: readonly (readonly [string, unknown])[];
	readonly path: YamlPath;
	readonly status: FieldStatus;
	readonly disabled: boolean;
	/** True while a test probe renders the form: show every item, open. */
	readonly expandAll: boolean;
	readonly readOnly: boolean;
	add(key: string, value: unknown): boolean;
	remove(key: string): boolean;
	rename(from: string, to: string): boolean;
	override(): void;
}

/**
 * Connects a map option whose keys are names the user picks (e.g.
 * docker-containers `containers`, keyed by container name) to the document.
 * @param name - Field name of the map, e.g. `containers`.
 * @returns The entries and map actions.
 */
export function useWidgetMap(name: string): WidgetMap {
	const { target, options, readOnly, form } = useWidgetForm();
	const watched: unknown = useWatch({ control: form.control, name });
	const probing = useFieldProbe(name);
	const entries =
		typeof watched === "object" && watched !== null && !Array.isArray(watched)
			? Object.entries(watched)
			: [];
	const path = toSubPath(name);
	const [key] = path;
	const option = typeof key === "string" ? options.get(key) : undefined;
	const status: FieldStatus = option
		? option.source === "own"
			? "own"
			: "inherited"
		: "unset";

	return {
		entries,
		path,
		status,
		disabled: readOnly || status === "inherited",
		readOnly,
		expandAll: probing,
		add: (entryKey, value) =>
			// A missing map is written whole; an existing one gets one more key.
			entries.length === 0
				? target.set(path, { [entryKey]: value })
				: target.set([...path, entryKey], value),
		// Removing the last entry removes the map's key.
		remove: (entryKey) =>
			target.remove(entries.length === 1 ? path : [...path, entryKey]),
		rename: (from, to) => target.rename(path, from, to),
		override: () => {
			if (!option || typeof key !== "string") return;
			target.set([key], option.value);
		},
	};
}
