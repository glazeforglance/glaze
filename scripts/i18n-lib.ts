// Pure helpers for scripts/i18n.ts: reading translation files, comparing a
// language with English and building the status table. No file system here,
// so every rule can be tested. Only erasable TypeScript (plain Node runs it).

/** A nested i18next JSON v4 file. */
export interface TextTree {
	[key: string]: string | TextTree;
}

/** i18next plural suffixes (JSON v4 uses the CLDR categories). */
const PLURAL = /_(zero|one|two|few|many|other)$/;

/**
 * Flattens a translation file to `a.b.c` keys.
 * @param tree - Parsed JSON.
 * @param prefix - Key prefix, used while recursing.
 * @returns Key → text.
 */
export function flatten(tree: TextTree, prefix = ""): Map<string, string> {
	const out = new Map<string, string>();
	for (const [key, value] of Object.entries(tree)) {
		const full = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") out.set(full, value);
		else for (const [k, v] of flatten(value, full)) out.set(k, v);
	}
	return out;
}

/**
 * Parses a translation file.
 * @param text - The file contents.
 * @returns The tree, or an error message for invalid JSON or a wrong shape.
 */
export function parseTranslations(
	text: string,
): { ok: true; value: TextTree } | { ok: false; error: string } {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
	const problem = shapeProblem(value, "");
	return problem === null
		? { ok: true, value: value as TextTree }
		: { ok: false, error: problem };
}

function shapeProblem(value: unknown, where: string): string | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return `${where || "the file"} must be an object of texts`;
	}
	for (const [key, child] of Object.entries(value)) {
		const path = where ? `${where}.${key}` : key;
		if (typeof child === "string") continue;
		const problem = shapeProblem(child, path);
		if (problem !== null) return problem;
	}
	return null;
}

/**
 * The placeholders and tags of a text, the things a translation must keep:
 * `{{name}}` (also `{{count, number}}` → `count`) and `<tag>` / `</tag>`
 * from <Trans> components.
 * @param text - A text.
 * @returns Sorted, e.g. `["{{count}}", "<file>", "</file>"]`.
 */
export function placeholders(text: string): string[] {
	const variables = [...text.matchAll(/\{\{\s*([\w.-]+)[^}]*\}\}/g)].map(
		(match) => `{{${match[1]}}}`,
	);
	// <Trans> tags come in pairs; a lone "<head>" is just text.
	const tags = [...text.matchAll(/<([a-z][\w-]*)>/g)]
		.map((match) => match[1] ?? "")
		.filter((name) => text.includes(`</${name}>`))
		.flatMap((name) => [`<${name}>`, `</${name}>`]);
	return [...variables, ...tags].sort();
}

/**
 * The key without its plural suffix: `files_one` → `files`.
 * @param key - A flat key.
 * @returns The base key.
 */
export function pluralBase(key: string): string {
	return key.replace(PLURAL, "");
}

/**
 * The keys a language must have: plural keys need the language's own plural
 * categories (Dutch: one, other; Arabic: six forms).
 * @param sourceKeys - English keys, e.g. `files_one`, `files_other`, `title`.
 * @param language - A language code.
 * @returns The keys, e.g. `["files_one", "files_other", "title"]`.
 */
export function requiredKeys(
	sourceKeys: readonly string[],
	language: string,
): string[] {
	const categories = pluralCategories(language);
	const keys = new Set<string>();
	for (const key of sourceKeys) {
		if (PLURAL.test(key)) {
			for (const category of categories)
				keys.add(`${pluralBase(key)}_${category}`);
		} else {
			keys.add(key);
		}
	}
	return [...keys];
}

function pluralCategories(language: string): string[] {
	try {
		return new Intl.PluralRules(language).resolvedOptions().pluralCategories;
	} catch {
		return ["one", "other"];
	}
}

/** What is wrong or missing in one translation file. */
export interface LanguageReport {
	/** Keys the language needs but doesn't have (or has empty). Warning. */
	readonly missing: string[];
	/** Keys English doesn't have (anymore). Warning. */
	readonly unused: string[];
	/** Keys whose placeholders or tags differ from English. Error. */
	readonly placeholderErrors: string[];
	/** Translated keys / required keys. */
	readonly translated: number;
	readonly total: number;
}

/**
 * Compares one translation file with its English source.
 * @param source - English, flattened.
 * @param target - The translation, flattened.
 * @param language - The translation's language code.
 * @returns What is missing, unused or broken.
 */
export function compareLanguage(
	source: ReadonlyMap<string, string>,
	target: ReadonlyMap<string, string>,
	language: string,
): LanguageReport {
	const required = requiredKeys([...source.keys()], language);
	const requiredSet = new Set(required);
	const missing = required.filter((key) => (target.get(key) ?? "") === "");
	const unused = [...target.keys()].filter((key) => !requiredSet.has(key));
	const placeholderErrors: string[] = [];
	for (const [key, text] of target) {
		if (text === "" || !requiredSet.has(key)) continue;
		// A plural form is compared with English "other" (it has {{count}}),
		// except a form English also has, which is compared with itself.
		const english =
			source.get(key) ??
			source.get(`${pluralBase(key)}_other`) ??
			source.get(pluralBase(key));
		if (english === undefined) continue;
		const want = placeholders(english).filter(
			(item) => !(PLURAL.test(key) && item === "{{count}}"),
		);
		const have = placeholders(text).filter(
			(item) => !(PLURAL.test(key) && item === "{{count}}"),
		);
		if (want.join(" ") !== have.join(" ")) placeholderErrors.push(key);
	}
	return {
		missing,
		unused,
		placeholderErrors,
		translated: required.length - missing.length,
		total: required.length,
	};
}

/**
 * Finds the translation keys the web app uses: string literals that are
 * keys, and the static start of template keys like `` `problems.${code}` ``.
 * @param sources - The contents of every source file.
 * @returns Exact keys and key prefixes.
 */
export function usedKeys(sources: readonly string[]): {
	exact: Set<string>;
	prefixes: Set<string>;
	/** Keys passed to t() / i18nKey literally, to check they exist. */
	called: Set<string>;
} {
	const exact = new Set<string>();
	const prefixes = new Set<string>();
	const called = new Set<string>();
	for (const source of sources) {
		for (const match of source.matchAll(
			/["'`]([a-z][\w-]*(?:\.[\w-]+)+)["'`]/gi,
		)) {
			exact.add(match[1] ?? "");
		}
		for (const match of source.matchAll(
			/`([a-z][\w-]*(?:\.[\w-]+)*\.)\$\{/gi,
		)) {
			prefixes.add(match[1] ?? "");
		}
		for (const match of source.matchAll(
			/(?:\bt\(\s*|i18nKey=)["']([^"']+)["']/g,
		)) {
			called.add(match[1] ?? "");
		}
	}
	return { exact, prefixes, called };
}

/**
 * Whether the code uses an English key (directly, through a plural form, or
 * through a template prefix).
 * @param key - A flat English key.
 * @param used - From `usedKeys`.
 * @returns True when some code reads it.
 */
export function isUsed(
	key: string,
	used: { exact: ReadonlySet<string>; prefixes: ReadonlySet<string> },
): boolean {
	if (used.exact.has(key) || used.exact.has(pluralBase(key))) return true;
	for (const prefix of used.prefixes) if (key.startsWith(prefix)) return true;
	return false;
}

/** One row of the status table. */
export interface StatusRow {
	readonly name: string;
	readonly code: string;
	readonly translated: number;
	readonly total: number;
}

/**
 * The Markdown status table for TRANSLATING.md.
 * @param rows - One row per language, English first.
 * @returns The table.
 */
export function statusTable(rows: readonly StatusRow[]): string {
	const cells = [
		["Language", "Code", "Translated"],
		...rows.map((row) => {
			const percent =
				row.total === 0 ? 100 : Math.floor((row.translated / row.total) * 100);
			return [row.name, `\`${row.code}\``, `${percent}%`];
		}),
	];
	// Padded like Biome formats Markdown tables, so the two never disagree.
	const widths = [0, 1, 2].map((column) =>
		Math.max(...cells.map((row) => [...(row[column] ?? "")].length)),
	);
	const line = (row: readonly string[]) =>
		`| ${row.map((cell, i) => cell + " ".repeat((widths[i] ?? 0) - [...cell].length)).join(" | ")} |`;
	const [header = [], ...body] = cells;
	return [
		line(header),
		`| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`,
		...body.map(line),
	].join("\n");
}

export const STATUS_START = "<!-- i18n-status:start -->";
export const STATUS_END = "<!-- i18n-status:end -->";

/**
 * Puts the table between the status markers of a Markdown file.
 * @param markdown - The file.
 * @param table - From `statusTable`.
 * @returns The new file, or `null` when the markers are missing.
 */
export function replaceStatus(markdown: string, table: string): string | null {
	const start = markdown.indexOf(STATUS_START);
	const end = markdown.indexOf(STATUS_END);
	if (start === -1 || end === -1 || end < start) return null;
	return `${markdown.slice(0, start + STATUS_START.length)}\n\n${table}\n\n${markdown.slice(end)}`;
}
