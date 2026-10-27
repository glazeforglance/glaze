// Reads defaults, enums and required fields from method bodies such as
// initialize(). Glance sets most defaults and checks most values in code,
// not in struct tags, so a struct-only generator would miss them.
//
// Patterns work on token text joined by single spaces (see go-parse.ts),
// e.g. `if widget . Limit <= 0 { widget . Limit = 15 ; }`.
//
// Runs on plain Node (built-in type stripping), so only erasable TypeScript here.

import type { GoFunc, GoPackage } from "./go-parse.ts";
import { unquote } from "./go-parse.ts";

/** What the code says about one field. */
export interface CodeFacts {
	default?: string | number | boolean;
	/** Values the code accepts; closed unless `allowCustom`. */
	options?: string[];
	allowCustom?: boolean;
	/** Values the code compares the field with (also outside validation). */
	compared?: string[];
	required?: boolean;
}

/** Facts per field path, e.g. `Limit` or `Servers.Timeout` (Go field names). */
export type FieldFacts = Map<string, CodeFacts>;

/** Facts about a widget as a whole, from its initialize(). */
export interface WidgetFacts {
	defaultTitle?: string;
	defaultTitleUrl?: string;
	defaultCache?: string;
}

const LITERAL =
	'"(?:[^"\\\\]|\\\\.)*"|- \\d+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|true|false';

const UNITS: Record<string, string> = {
	Second: "s",
	Minute: "m",
	Hour: "h",
};

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function literalValue(text: string): string | number | boolean {
	if (text.startsWith('"')) return unquote(text);
	if (text === "true") return true;
	if (text === "false") return false;
	return Number(text.replace(/ /g, ""));
}

/** Reads `N * time . Unit`, `time . Unit * N` or `time . Unit` as `30m`. */
function durationText(expression: string): string | null {
	const match =
		/^(?:(\d+) \* )?time \. (Second|Minute|Hour)(?: \* (\d+))?$/.exec(
			expression.trim(),
		);
	if (!match) return null;
	const amount = Number(match[1] ?? match[3] ?? "1");
	const unit = UNITS[match[2] ?? ""] ?? "s";
	// `24 * time.Hour` reads better as 1d, like Glance's own syntax.
	if (unit === "h" && amount % 24 === 0) return `${amount / 24}d`;
	return `${amount}${unit}`;
}

function add(facts: FieldFacts, path: string, update: CodeFacts): void {
	const current = facts.get(path) ?? {};
	const merged: CodeFacts = { ...current };
	if (update.default !== undefined && merged.default === undefined) {
		merged.default = update.default;
	}
	if (update.options) {
		merged.options = [
			...new Set([...(merged.options ?? []), ...update.options]),
		];
	}
	if (update.allowCustom) merged.allowCustom = true;
	if (update.compared) {
		merged.compared = [
			...new Set([...(merged.compared ?? []), ...update.compared]),
		];
	}
	if (update.required) merged.required = true;
	facts.set(path, merged);
}

/** A field reference: `w . Limit` or `w . Servers [ i ] . Timeout`. */
function pathPattern(receiver: string): string {
	return `${escape(receiver)} \\. (\\w+)(?: \\[ \\w+ \\] \\. (\\w+))?`;
}

function pathOf(match: RegExpMatchArray, first: number): string {
	const outer = match[first] ?? "";
	const inner = match[first + 1];
	return inner ? `${outer}.${inner}` : outer;
}

/** Resolves a `case` label: a string literal or a string constant. */
function caseValue(label: string, pkg: GoPackage): string | null {
	const text = label.trim();
	if (text.startsWith('"') || text.startsWith("`")) return unquote(text);
	return pkg.consts.get(text) ?? HTTP_CONSTS[text] ?? null;
}

// Constants from Go's standard library that Glance uses as values.
const HTTP_CONSTS: Record<string, string> = {
	"http . MethodGet": "GET",
	"http . MethodPost": "POST",
};

/** Finds the `{ ... }` block that starts at `open` (an index of `{`). */
function blockAt(text: string, open: number): string {
	let depth = 0;
	for (let i = open; i < text.length; i += 1) {
		if (text[i] === "{") depth += 1;
		if (text[i] === "}") {
			depth -= 1;
			if (depth === 0) return text.slice(open + 1, i);
		}
	}
	return text.slice(open + 1);
}

/**
 * Collects what a method body says about the receiver's fields.
 * @param fn - A method, e.g. a widget's initialize().
 * @param pkg - The package (for constants and map literals).
 * @returns Facts per field path (Go field names).
 */
export function analyzeBody(fn: GoFunc, pkg: GoPackage): FieldFacts {
	const facts: FieldFacts = new Map();
	const receiver = fn.receiverName;
	if (!receiver) return facts;
	const body = fn.body;
	const path = pathPattern(receiver);

	// Aliases like `s := widget . SortBy ;` are read as the field itself.
	const aliases = new Map<string, string>();
	for (const match of body.matchAll(new RegExp(`(\\w+) := ${path} ;`, "g"))) {
		aliases.set(match[1] ?? "", pathOf(match, 2));
	}
	const ref = `(?:${path}|${[...aliases.keys()].map(escape).join("|") || "(?!)"})`;
	const resolve = (match: RegExpMatchArray, first: number): string => {
		if (match[first] !== undefined) return pathOf(match, first);
		const alias = match[0].trim().split(" ")[0] ?? "";
		return aliases.get(alias) ?? alias;
	};

	// Every `if <condition> {` with its then-block, in order.
	for (const match of body.matchAll(/if ([^{]*?) \{/g)) {
		const condition = match[1] ?? "";
		const open = (match.index ?? 0) + match[0].length - 1;
		const block = blockAt(body, open);

		// `x != "a" && x != "b"`: the accepted values.
		const unequal = new Map<string, string[]>();
		for (const part of condition.matchAll(
			new RegExp(`${ref} != (${LITERAL})`, "g"),
		)) {
			const field = resolve(part, 1);
			const value = literalValue(part[part.length - 1] ?? "");
			if (typeof value !== "string" || value === "") continue;
			unequal.set(field, [...(unequal.get(field) ?? []), value]);
		}
		for (const [field, values] of unequal) {
			if (values.length >= 2) add(facts, field, { options: values });
		}

		// `x == "" { return errors ... }`: the field is required.
		const empty = new RegExp(`^${ref} == (?:""|0)$`).exec(condition.trim());
		if (empty && /^\s*return (?:errors|fmt) \./.test(block)) {
			add(facts, resolve(empty, 1), { required: true });
		}

		// `<condition about x> { x = <literal> ; }`: x's default.
		const assign = new RegExp(
			`^\\s*${path} = (${LITERAL}|durationField \\( .+? \\)) ; $`,
		).exec(block);
		if (assign) {
			const field = pathOf(assign, 1);
			const raw = assign[3] ?? "";
			const value = raw.startsWith("durationField")
				? durationText(raw.slice("durationField ( ".length, -" )".length))
				: literalValue(raw);
			const mentions = new RegExp(
				`(?:^|\\s)${escape(receiver)} \\. ${field.split(".").map(escape).join(" (?:\\[ \\w+ \\] )?\\. ")}(?:\\s|$)`,
			).test(` ${condition} `);
			const aboutAlias = [...aliases].some(
				([alias, target]) =>
					target === field &&
					new RegExp(`(?:^|\\s)${alias}(?:\\s|$)`).test(condition),
			);
			if (value !== null && (mentions || aboutAlias)) {
				add(facts, field, { default: value });
			}
		}
	}

	// Values the code compares a field with, anywhere in the body.
	for (const match of body.matchAll(
		new RegExp(`${ref} (?:==|!=) (${LITERAL})`, "g"),
	)) {
		const value = literalValue(match[match.length - 1] ?? "");
		if (typeof value === "string" && value !== "") {
			add(facts, resolve(match, 1), { compared: [value] });
		}
	}

	// `switch x { case A , B : ... }`: the cases are the accepted values.
	for (const match of body.matchAll(new RegExp(`switch ${path} \\{`, "g"))) {
		const open = (match.index ?? 0) + match[0].length - 1;
		const block = blockAt(body, open);
		const values: string[] = [];
		for (const label of block.matchAll(/case ([^:]+?) :/g)) {
			for (const item of (label[1] ?? "").split(" , ")) {
				const value = caseValue(item, pkg);
				if (value !== null) values.push(value);
			}
		}
		if (values.length > 0 && /default : return/.test(block)) {
			add(facts, pathOf(match, 1), { options: values });
		} else if (values.length > 0) {
			add(facts, pathOf(match, 1), { compared: values });
		}
	}

	// `someMap [ x ]`: the map's keys are the values. A lookup followed by
	// `; ! ok {` (an error when missing) means only those; otherwise other
	// values are allowed too (e.g. a search URL instead of an engine name).
	const lookups = new Map<string, { keys: string[]; closed: boolean }>();
	for (const match of body.matchAll(
		new RegExp(`(\\w+) \\[ ${path} \\]( ; ! ok \\{)?`, "g"),
	)) {
		const keys = pkg.mapKeys.get(match[1] ?? "");
		if (!keys) continue;
		const field = pathOf(match, 2);
		const seen = lookups.get(field);
		lookups.set(field, {
			keys,
			closed: (seen?.closed ?? false) || match[4] !== undefined,
		});
	}
	for (const [field, { keys, closed }] of lookups) {
		add(
			facts,
			field,
			closed ? { options: keys } : { options: keys, allowCustom: true },
		);
	}
	return facts;
}

/**
 * Reads the title, title link and refresh interval a widget sets for itself.
 * @param fn - The widget's initialize().
 * @returns What was found.
 */
export function analyzeWidget(fn: GoFunc): WidgetFacts {
	const facts: WidgetFacts = {};
	const title = /with[Tt]itle \( ("(?:[^"\\]|\\.)*") \)/.exec(fn.body);
	if (title?.[1] !== undefined) facts.defaultTitle = unquote(title[1]);
	const titleUrl = /withTitleURL \( ("(?:[^"\\]|\\.)*") \)/.exec(fn.body);
	if (titleUrl?.[1] !== undefined) facts.defaultTitleUrl = unquote(titleUrl[1]);
	const cache = /withCacheDuration \( (.+?) \)/.exec(fn.body);
	const text = cache?.[1] ? durationText(cache[1]) : null;
	if (text) facts.defaultCache = text;
	if (/withCacheOnTheHour \( \)/.test(fn.body))
		facts.defaultCache = "on the hour";
	return facts;
}
