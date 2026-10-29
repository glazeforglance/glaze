// Reads apps/web/src/locales and TRANSLATING.md for scripts/i18n.ts and
// scripts/release.ts, so both build the status table the same way. The rules
// themselves are in i18n-lib.ts; this file only touches the disk (reading,
// never writing, so callers decide when to write).
// Only erasable TypeScript here (plain Node runs it).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	compareLanguage,
	flatten,
	isUsed,
	languageName,
	parseStatus,
	parseTranslations,
	replaceStatus,
	type StatusRow,
	statusChanges,
	statusTable,
	usedKeys,
} from "./i18n-lib.ts";

export const LOCALES_DIR = "apps/web/src/locales";
export const TRANSLATING_FILE = "TRANSLATING.md";
export const SOURCE_LANGUAGE = "en";
export const NAMESPACES = ["app", "fields"] as const;

/** Every translation compared with English. */
export interface TranslationStatus {
	/** English, flattened per namespace (`null` when missing or invalid). */
	readonly source: ReadonlyMap<string, ReadonlyMap<string, string> | null>;
	/** One row per language, English first. */
	readonly rows: StatusRow[];
	/** Language folders besides English. */
	readonly languages: string[];
	/** Invalid JSON and broken placeholders or tags. */
	readonly errors: string[];
	/** Missing or unused keys. */
	readonly warnings: string[];
}

function list(keys: readonly string[]): string {
	const shown = keys.slice(0, 8).join(", ");
	return keys.length > 8 ? `${shown}, … (${keys.length} in total)` : shown;
}

/**
 * Reads every translation file and compares it with English.
 * @param root - The repository root.
 * @returns Rows for the status table, plus errors and warnings.
 */
export function readTranslationStatus(root: string): TranslationStatus {
	const locales = join(root, LOCALES_DIR);
	const errors: string[] = [];
	const warnings: string[] = [];
	const load = (folder: string, namespace: string) => {
		const file = `${folder}/${namespace}.json`;
		let text: string;
		try {
			text = readFileSync(join(locales, file), "utf8");
		} catch {
			return null;
		}
		const parsed = parseTranslations(text);
		if (!parsed.ok) {
			errors.push(`${file}: invalid JSON (${parsed.error})`);
			return null;
		}
		return flatten(parsed.value);
	};

	const source = new Map(
		NAMESPACES.map((namespace) => [
			namespace,
			load(SOURCE_LANGUAGE, namespace),
		]),
	);
	const languages = readdirSync(locales)
		.filter(
			(name) =>
				name !== SOURCE_LANGUAGE && statSync(join(locales, name)).isDirectory(),
		)
		.sort();
	const rows: StatusRow[] = [
		{
			name: languageName(SOURCE_LANGUAGE),
			code: SOURCE_LANGUAGE,
			translated: 1,
			total: 1,
		},
	];
	for (const folder of languages) {
		const code = folder.replaceAll("_", "-");
		let translated = 0;
		let total = 0;
		for (const namespace of NAMESPACES) {
			const english = source.get(namespace);
			if (!english) continue;
			const target = load(folder, namespace) ?? new Map<string, string>();
			const report = compareLanguage(english, target, code);
			translated += report.translated;
			total += report.total;
			const file = `${folder}/${namespace}.json`;
			if (report.placeholderErrors.length > 0) {
				errors.push(
					`${file}: placeholders or tags differ from English in ${list(report.placeholderErrors)}`,
				);
			}
			if (report.missing.length > 0) {
				warnings.push(
					`${file}: ${report.missing.length} missing: ${list(report.missing)}`,
				);
			}
			if (report.unused.length > 0) {
				warnings.push(
					`${file}: ${report.unused.length} unused: ${list(report.unused)}`,
				);
			}
		}
		rows.push({ name: languageName(code), code, translated, total });
	}
	return { source, rows, languages, errors, warnings };
}

/** TRANSLATING.md with a fresh status table, or why there is none. */
export type StatusRefresh =
	| { readonly ok: false; readonly errors: string[] }
	| {
			readonly ok: true;
			/** The file as it is now. */
			readonly before: string;
			/** The file with the new table; equal to `before` when nothing changed. */
			readonly after: string;
			/** E.g. `fil 0% → 42%`; empty when no percentage changed. */
			readonly changes: string[];
	  };

/**
 * Builds TRANSLATING.md with an up-to-date status table, without writing it.
 * Only invalid JSON, broken placeholders or missing markers stop it; a
 * missing or incomplete language is fine.
 * @param root - The repository root.
 * @returns The old and new text and what changed, or the errors.
 */
export function refreshStatusTable(root: string): StatusRefresh {
	const status = readTranslationStatus(root);
	if (status.errors.length > 0) return { ok: false, errors: status.errors };
	const before = readFileSync(join(root, TRANSLATING_FILE), "utf8");
	const after = replaceStatus(before, statusTable(status.rows));
	if (after === null) {
		return {
			ok: false,
			errors: [`${TRANSLATING_FILE} has no i18n-status markers`],
		};
	}
	return {
		ok: true,
		before,
		after,
		changes: statusChanges(parseStatus(before), status.rows),
	};
}

/** The result of `pnpm i18n --check`. */
export interface TranslationCheck {
	readonly status: TranslationStatus;
	/** The status table as it should be. */
	readonly table: string;
	/** Fail the check: invalid JSON, broken placeholders, code and English disagree. */
	readonly errors: string[];
	/** Missing or unused translations. */
	readonly warnings: string[];
	/**
	 * The table in TRANSLATING.md differs from `table`. Only a note: Weblate's
	 * pull requests don't regenerate it, and `release:prepare` does.
	 */
	readonly staleTable: boolean;
}

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			return name === "locales" ? [] : sourceFiles(path);
		}
		return /\.tsx?$/.test(name) ? [path] : [];
	});
}

/**
 * Everything `pnpm i18n --check` checks: each translation against English,
 * and English against the keys the web app's code uses.
 * @param root - The repository root.
 * @returns Errors, warnings, the table and whether TRANSLATING.md lags behind.
 */
export function checkTranslations(root: string): TranslationCheck {
	const status = readTranslationStatus(root);
	const errors = [...status.errors];
	const app = status.source.get("app");
	if (!app) {
		errors.unshift(`${LOCALES_DIR}/en/app.json is missing or invalid`);
	} else {
		const used = usedKeys(
			sourceFiles(join(root, "apps/web/src")).map((file) =>
				readFileSync(file, "utf8"),
			),
		);
		const notInCode = [...app.keys()].filter((key) => !isUsed(key, used));
		if (notInCode.length > 0) {
			errors.push(
				`en/app.json has keys the code doesn't use: ${list(notInCode)}`,
			);
		}
		const fields = status.source.get("fields");
		const known = (key: string) => {
			const [namespace, rest = ""] = key.includes(":")
				? key.split(":", 2)
				: ["app", key];
			const flat = namespace === "fields" ? fields : app;
			return (
				flat?.has(rest) === true ||
				flat?.has(`${rest}_other`) === true ||
				flat?.has(`${rest}_one`) === true
			);
		};
		const notInSource = [...used.called].filter((key) => !known(key));
		if (notInSource.length > 0) {
			errors.push(
				`the code uses keys en/app.json doesn't have: ${list(notInSource)}`,
			);
		}
	}
	const table = statusTable(status.rows);
	let staleTable = false;
	try {
		const markdown = readFileSync(join(root, TRANSLATING_FILE), "utf8");
		staleTable = replaceStatus(markdown, table) !== markdown;
	} catch {
		staleTable = false;
	}
	return { status, table, errors, warnings: status.warnings, staleTable };
}
