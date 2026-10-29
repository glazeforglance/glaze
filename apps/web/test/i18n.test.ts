import { widgetSchema } from "@glaze/schemas";
import { afterEach, describe, expect, it } from "vitest";
import {
	AVAILABLE_LANGUAGES,
	changeLanguage,
	fieldText,
	i18n,
	localizedWidget,
} from "../src/i18n.ts";
import {
	detectLanguage,
	directionOf,
	languageName,
	localeOf,
	matchLanguage,
	normalizeLanguage,
	RTL_TEST_LANGUAGE,
} from "../src/lib/languages.ts";
import { problemText } from "../src/lib/messages.ts";

const AVAILABLE = ["en", "nl", "pt-BR"];

describe("detectLanguage", () => {
	it("uses the saved choice first", () => {
		expect(detectLanguage("nl", ["en-US"], AVAILABLE)).toBe("nl");
	});

	it("ignores a saved language that is gone", () => {
		expect(detectLanguage("fr", ["nl-NL"], AVAILABLE)).toBe("nl");
	});

	it("maps a browser language to its base language", () => {
		expect(detectLanguage(null, ["nl-NL"], AVAILABLE)).toBe("nl");
		expect(detectLanguage(null, ["nl-BE", "en"], AVAILABLE)).toBe("nl");
	});

	it("prefers an exact regional match", () => {
		expect(detectLanguage(null, ["pt-br"], AVAILABLE)).toBe("pt-BR");
	});

	it("walks the browser's list in order", () => {
		expect(detectLanguage(null, ["fr-FR", "nl"], AVAILABLE)).toBe("nl");
	});

	it("falls back to English", () => {
		expect(detectLanguage(null, ["fr-FR", "de"], AVAILABLE)).toBe("en");
		expect(detectLanguage(null, [], AVAILABLE)).toBe("en");
	});
});

describe("language helpers", () => {
	it("normalizes Weblate's folder names", () => {
		expect(normalizeLanguage("pt_BR")).toBe("pt-BR");
		expect(matchLanguage("pt_BR", AVAILABLE)).toBe("pt-BR");
		expect(matchLanguage("", AVAILABLE)).toBeNull();
	});

	it("names a language in its own language", () => {
		expect(languageName("nl")).toBe("Nederlands");
		expect(languageName("en")).toBe("English");
		expect(languageName(RTL_TEST_LANGUAGE)).toBe("RTL test");
	});

	it("knows which way languages are written", () => {
		const dir = (code: string) => i18n.dir(code);
		expect(directionOf("ar", dir)).toBe("rtl");
		expect(directionOf("he", dir)).toBe("rtl");
		expect(directionOf("nl", dir)).toBe("ltr");
		expect(directionOf(RTL_TEST_LANGUAGE, dir)).toBe("rtl");
		expect(localeOf(RTL_TEST_LANGUAGE)).toBe("en");
	});

	it("finds the translations in src/locales, plus the RTL test language", () => {
		expect(AVAILABLE_LANGUAGES[0]).toBe("en");
		expect(AVAILABLE_LANGUAGES).toContain("nl");
		expect(AVAILABLE_LANGUAGES).toContain(RTL_TEST_LANGUAGE);
	});
});

describe("translations", () => {
	afterEach(async () => {
		await changeLanguage("en");
	});

	it("uses plural forms", () => {
		expect(i18n.t("canvas.columnCount", { count: 1 })).toBe("1 column");
		expect(i18n.t("canvas.columnCount", { count: 3 })).toBe("3 columns");
	});

	it("falls back to English for a missing key", async () => {
		i18n.addResourceBundle("xx", "app", { common: { cancel: "Annuleren" } });
		await i18n.changeLanguage("xx");
		expect(i18n.t("common.cancel")).toBe("Annuleren");
		expect(i18n.t("common.dismiss")).toBe("Dismiss");
	});

	it("falls back to English schema texts", async () => {
		i18n.addResourceBundle("xx", "fields", {
			widget: { weather: { name: "Météo" } },
		});
		await i18n.changeLanguage("xx");
		const weather = widgetSchema("weather");
		expect(weather && localizedWidget(weather).label).toBe("Météo");
		expect(fieldText("widget.weather.fields.location.label", "?")).toBe(
			"Location",
		);
	});

	it("loads Dutch on demand", async () => {
		await changeLanguage("nl");
		expect(i18n.language).toBe("nl");
		expect(i18n.t("common.cancel")).toBe("Annuleren");
	});

	it("builds sentences from problem codes", () => {
		expect(
			problemText({
				code: "missing-option",
				params: {
					widget: "widget.weather",
					option: "widget.weather.fields.location",
				},
				message: "Weather needs a location",
			}),
		).toBe("Weather needs a value for “Location”");
		expect(
			problemText({ code: "from-a-newer-server", message: "As it is" }),
		).toBe("As it is");
	});
});
