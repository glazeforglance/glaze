/*
 * Language helpers without i18next: which language to start in, what a
 * language is called, and which way it is written. Kept pure so the rules
 * are easy to test; i18n.ts wires them up.
 */

/** The language the code is written in; every other language falls back to it. */
export const SOURCE_LANGUAGE = "en";

/**
 * A dev-only pseudo-language: English text, laid out right-to-left, to test
 * the RTL layout before a real RTL translation exists.
 */
export const RTL_TEST_LANGUAGE = "rtl-test";

/** Where the picked language is remembered. */
export const LANGUAGE_STORAGE_KEY = "glaze.language";

/** Which way a language is written. */
export type TextDirection = "ltr" | "rtl";

/**
 * Normalizes a language code: Weblate may name folders `pt_BR`, browsers say `pt-BR`.
 * @param code - A language code.
 * @returns The code with `-` as separator, e.g. `pt-BR`.
 */
export function normalizeLanguage(code: string): string {
	return code.trim().replaceAll("_", "-");
}

/**
 * Finds the available language that fits a wanted one: the exact code
 * (ignoring case), else its base language (`nl-NL` → `nl`).
 * @param wanted - E.g. a browser language like `nl-NL`.
 * @param available - The languages Glaze has.
 * @returns The matching code, or `null`.
 */
export function matchLanguage(
	wanted: string,
	available: readonly string[],
): string | null {
	const code = normalizeLanguage(wanted).toLowerCase();
	if (code === "") return null;
	const exact = available.find((language) => language.toLowerCase() === code);
	if (exact !== undefined) return exact;
	const base = code.split("-")[0] ?? code;
	return available.find((language) => language.toLowerCase() === base) ?? null;
}

/**
 * Picks the language to start in: the saved choice, then the browser's
 * languages in order, then English.
 * @param saved - The remembered choice, or `null`.
 * @param preferred - `navigator.languages` (or `[navigator.language]`).
 * @param available - The languages Glaze has.
 * @returns A code from `available`, or `SOURCE_LANGUAGE`.
 */
export function detectLanguage(
	saved: string | null,
	preferred: readonly string[],
	available: readonly string[],
): string {
	// A saved choice only counts exactly, so a removed language falls back cleanly.
	if (saved !== null && available.includes(saved)) return saved;
	for (const wanted of preferred) {
		const match = matchLanguage(wanted, available);
		if (match !== null) return match;
	}
	return SOURCE_LANGUAGE;
}

/**
 * The locale for `Intl` formatting and `<html lang>`.
 * @param language - An active language code.
 * @returns A BCP 47 tag (`rtl-test` formats like English).
 */
export function localeOf(language: string): string {
	return language === RTL_TEST_LANGUAGE ? SOURCE_LANGUAGE : language;
}

/**
 * What a language calls itself, e.g. "Nederlands" for `nl`, so people find
 * their language even when the UI is in one they can't read.
 * @param language - A language code.
 * @returns The name, starting with a capital where the script has them.
 */
export function languageName(language: string): string {
	if (language === RTL_TEST_LANGUAGE) return "RTL test";
	try {
		const name = new Intl.DisplayNames([language], { type: "language" }).of(
			language,
		);
		if (name === undefined || name === language) return language;
		return name.charAt(0).toLocaleUpperCase(language) + name.slice(1);
	} catch {
		// An invalid tag from a folder name: show the code itself.
		return language;
	}
}

/**
 * Which way a language is written.
 * @param language - A language code.
 * @param dirOf - i18next's `dir()`, which knows the RTL languages.
 * @returns `rtl` or `ltr`.
 */
export function directionOf(
	language: string,
	dirOf: (language: string) => TextDirection,
): TextDirection {
	return language === RTL_TEST_LANGUAGE ? "rtl" : dirOf(language);
}

/**
 * Reads the saved language; storage can be blocked (private mode, policies).
 * @returns The saved code, or `null`.
 */
export function readSavedLanguage(): string | null {
	try {
		return localStorage.getItem(LANGUAGE_STORAGE_KEY);
	} catch {
		return null;
	}
}

/**
 * Remembers the picked language, when storage allows it.
 * @param language - The code to save.
 */
export function saveLanguage(language: string): void {
	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
	} catch {
		// Not remembered, but the switch itself still works.
	}
}
