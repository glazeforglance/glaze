import { isAlias, isMap, isNode, isSeq, type YAMLMap } from "yaml";
import type { GlazeDocument } from "./document.ts";
import { splitItemPath } from "./edit.ts";
import { err, ok, type Result } from "./result.ts";
import { editError } from "./text-edit.ts";
import type { EditError, YamlPath } from "./types.ts";
import { WIDGET_LISTS } from "./widgets.ts";
import {
	getNodeAt,
	isMergeKey,
	type ParsedYaml,
	pairKey,
	readInclude,
	resolveNode,
} from "./yaml-read.ts";

/** Where an option's value comes from. */
export type OptionSource = "own" | "inherited";

/** The variable forms Glance replaces: `${NAME}`, `${secret:name}`, `${readFileFromEnv:NAME}`. */
export type EnvReferenceKind = "env" | "secret" | "readFileFromEnv";

/** One Glance variable found in a string. */
export interface EnvMatch {
	readonly kind: EnvReferenceKind;
	readonly name: string;
	/** The reference as written, e.g. `${GITHUB_TOKEN}`. */
	readonly raw: string;
	/** True when the string is exactly this reference and nothing else. */
	readonly whole: boolean;
}

/** A Glance variable inside an option value. */
export interface EnvReference extends EnvMatch {
	/** Where in the option value, e.g. `[]` for a plain string or `[2, "url"]` in a list. */
	readonly path: YamlPath;
}

/** One option of a widget, as read from the document. */
export interface WidgetOption {
	readonly key: string;
	/** Plain JS value. Variables like `${NAME}` are kept as text, never resolved. */
	readonly value: unknown;
	readonly source: OptionSource;
	/** True for an own option that also exists through a merge key. */
	readonly overridesInherited: boolean;
	readonly env: readonly EnvReference[];
}

/** All options of a widget. */
export interface WidgetOptions {
	/** True when the widget item is an alias (`- *name`): its values belong to the anchor. */
	readonly isAlias: boolean;
	/** In source order: the widget's own options first, then inherited ones. */
	readonly options: ReadonlyMap<string, WidgetOption>;
}

// Same pattern as Glance v0.8.7 (`configVariablePattern` in config.go). Glance
// matches against the raw file, where a value is always preceded by some
// character, so a newline counts as a prefix here too.
const VARIABLE_PATTERN = /(^|[\s\S])\$\{(?:([a-zA-Z]+):)?([a-zA-Z0-9_-]+)\}/g;
// Glance leaves `${name}` alone when an env name isn't upper case.
const ENV_NAME_PATTERN = /^[A-Z0-9_]+$/;

function variableKind(type: string, name: string): EnvReferenceKind | null {
	if (type === "") return ENV_NAME_PATTERN.test(name) ? "env" : null;
	if (type === "secret") return "secret";
	if (type === "readFileFromEnv") {
		return ENV_NAME_PATTERN.test(name) ? "readFileFromEnv" : null;
	}
	return null;
}

/**
 * Finds the Glance variables in a string, following Glance's own rules:
 * `\${NAME}` is escaped, unknown types and lower-case env names are ignored.
 * @param text - Any string value.
 * @returns The references, in order.
 */
export function findEnvReferences(text: string): EnvMatch[] {
	const found: EnvMatch[] = [];
	for (const match of text.matchAll(VARIABLE_PATTERN)) {
		const [all, prefix = "", type = "", name = ""] = match;
		if (prefix === "\\") continue;
		const kind = variableKind(type, name);
		if (kind === null) continue;
		const raw = all.slice(prefix.length);
		found.push({ kind, name, raw, whole: raw === text });
	}
	return found;
}

function collectEnv(
	value: unknown,
	path: YamlPath,
	into: EnvReference[],
): void {
	if (typeof value === "string") {
		for (const match of findEnvReferences(value)) into.push({ ...match, path });
	} else if (Array.isArray(value)) {
		value.forEach((item, index) => {
			collectEnv(item, [...path, index], into);
		});
	} else if (typeof value === "object" && value !== null) {
		for (const [key, item] of Object.entries(value)) {
			collectEnv(item, [...path, key], into);
		}
	}
}

function makeOption(
	yaml: ParsedYaml,
	key: string,
	node: unknown,
	source: OptionSource,
): WidgetOption {
	const value: unknown = isNode(node) ? node.toJS(yaml) : (node ?? null);
	const env: EnvReference[] = [];
	collectEnv(value, [], env);
	return { key, value, source, overridesInherited: false, env };
}

/** Collects keys from merge keys, depth first; the first source that sets a key wins. */
function collectInherited(
	yaml: ParsedYaml,
	map: YAMLMap,
	into: Map<string, unknown>,
	seen: Set<YAMLMap>,
): void {
	for (const pair of map.items) {
		if (!isMergeKey(pair.key)) continue;
		const merged = resolveNode(yaml, pair.value);
		const sources = isSeq(merged) ? merged.items : [merged];
		for (const source of sources) {
			const resolved = resolveNode(yaml, source);
			if (!isMap(resolved) || seen.has(resolved)) continue;
			seen.add(resolved);
			for (const inner of resolved.items) {
				if (isMergeKey(inner.key)) continue;
				const key = String(pairKey(inner.key));
				if (!into.has(key)) into.set(key, inner.value);
			}
			collectInherited(yaml, resolved, into, seen);
		}
	}
}

/**
 * Reads every option of a widget, including those that only come from a merge
 * key (`<<: *anchor`). Unknown keys are reported like any other option.
 * @param doc - The document to read.
 * @param widgetPath - Path of the widget.
 * @returns The options, or why they couldn't be read (e.g. an `$include` item).
 */
export function getWidgetOptions(
	doc: GlazeDocument,
	widgetPath: YamlPath,
): Result<WidgetOptions, EditError> {
	const item = splitItemPath(widgetPath, WIDGET_LISTS);
	if (!item.ok) return item;
	const node = getNodeAt(doc.yaml, widgetPath);
	if (readInclude(node) !== null) {
		return err(
			editError(
				"unsupported-structure",
				"This widget is an include; edit the included file instead",
			),
		);
	}
	const map = resolveNode(doc.yaml, node);
	if (!isMap(map)) {
		return err(
			editError("not-found", `No widget at ${JSON.stringify(widgetPath)}`),
		);
	}
	const options = new Map<string, WidgetOption>();
	for (const pair of map.items) {
		if (isMergeKey(pair.key)) continue;
		const key = String(pairKey(pair.key));
		if (!options.has(key))
			options.set(key, makeOption(doc.yaml, key, pair.value, "own"));
	}
	const inherited = new Map<string, unknown>();
	collectInherited(doc.yaml, map, inherited, new Set());
	for (const [key, valueNode] of inherited) {
		const own = options.get(key);
		options.set(
			key,
			own
				? { ...own, overridesInherited: true }
				: makeOption(doc.yaml, key, valueNode, "inherited"),
		);
	}
	return ok({ isAlias: isAlias(node), options });
}
