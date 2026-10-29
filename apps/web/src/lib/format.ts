/*
 * Dates and numbers in the UI language, via Intl. Formatters are cached per
 * locale, since creating one is slow compared to using it.
 */

const timeFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();

/**
 * A time of day like "14:05" (or "2:05 PM"), the way the locale writes it.
 * @param date - The moment.
 * @param locale - The UI locale, from `useLanguage().locale`.
 * @returns Hours and minutes.
 */
export function formatTime(date: Date, locale: string): string {
	let format = timeFormats.get(locale);
	if (!format) {
		format = new Intl.DateTimeFormat(locale, {
			hour: "2-digit",
			minute: "2-digit",
		});
		timeFormats.set(locale, format);
	}
	return format.format(date);
}

/**
 * A number the way the locale writes it, e.g. "1.234,5" in Dutch.
 * @param value - The number.
 * @param locale - The UI locale, from `useLanguage().locale`.
 * @returns The formatted number.
 */
export function formatNumber(value: number, locale: string): string {
	let format = numberFormats.get(locale);
	if (!format) {
		format = new Intl.NumberFormat(locale);
		numberFormats.set(locale, format);
	}
	return format.format(value);
}
