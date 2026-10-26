import {
	type EnvReference,
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
import { toSubPath, valueAt } from "./paths.ts";
import { validateField } from "./validate.ts";

/** Everything the fields of one widget form share. */
export interface WidgetFormApi {
	readonly widget: WidgetNode;
	readonly schema: z.ZodType;
	readonly options: ReadonlyMap<string, WidgetOption>;
	/** True for alias widgets: every field is shown but can't be changed. */
	readonly readOnly: boolean;
	readonly form: UseFormReturn<FieldValues>;
}

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

/** Reads the widget's values from the store right now, not from the last render. */
function currentValues(widgetId: string): Record<string, unknown> | null {
	const state = editorStore.getState();
	const page = selectCurrentPage(state);
	const widget = page ? findWidget(page, widgetId) : null;
	if (!state.doc || !widget) return null;
	const options = getWidgetOptions(state.doc, widget.path);
	return options.ok ? optionValues(options.value.options) : null;
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
	const { widget, schema, options, readOnly, form } = useWidgetForm();
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
		const values = currentValues(widget.id);
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
		const store = editorStore.getState();
		const applied =
			path.length === 1
				? plan.kind === "set"
					? store.setWidgetOption(widget.id, key, plan.value)
					: store.removeWidgetOption(widget.id, key)
				: plan.kind === "set"
					? store.setWidgetValue(widget.id, path, plan.value)
					: store.removeWidgetValue(widget.id, path);
		if (!applied) form.resetField(name);
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
			editorStore.getState().setWidgetOption(widget.id, key, option.value);
		},
	};
}

/** What a list editor needs. */
export interface WidgetList {
	readonly items: readonly unknown[];
	readonly path: YamlPath;
	readonly status: FieldStatus;
	readonly disabled: boolean;
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
	const { widget, options, readOnly, form } = useWidgetForm();
	const watched: unknown = useWatch({ control: form.control, name });
	const items = Array.isArray(watched) ? watched : [];
	const path = toSubPath(name);
	const [key] = path;
	const option = typeof key === "string" ? options.get(key) : undefined;
	const status: FieldStatus = option
		? option.source === "own"
			? "own"
			: "inherited"
		: "unset";
	const store = () => editorStore.getState();

	return {
		items,
		path,
		status,
		disabled: readOnly || status === "inherited",
		readOnly,
		add: (value, index) =>
			store().insertWidgetListItem(widget.id, path, value, index),
		remove: (index) => {
			// Removing the last item removes the key, instead of leaving `sites:` empty.
			if (items.length === 1) {
				return path.length === 1 && typeof key === "string"
					? store().removeWidgetOption(widget.id, key)
					: store().removeWidgetValue(widget.id, path);
			}
			return store().removeWidgetValue(widget.id, [...path, index]);
		},
		move: (fromIndex, toIndex) =>
			store().moveWidgetListItem(widget.id, path, fromIndex, toIndex),
		override: () => {
			if (!option || typeof key !== "string") return;
			store().setWidgetOption(widget.id, key, option.value);
		},
	};
}
