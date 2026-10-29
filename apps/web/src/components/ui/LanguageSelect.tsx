import { useId } from "react";
import { useTranslation } from "react-i18next";
import { changeLanguage, PICKER_LANGUAGES, useLanguage } from "../../i18n.ts";
import { languageName } from "../../lib/languages.ts";
import { LanguageIcon } from "./icons.tsx";

/**
 * A small language select for screens without the user menu (the login
 * screen). Each language is listed in its own name.
 * @returns The labelled select.
 */
export function LanguageSelect() {
	const { t } = useTranslation();
	const { language } = useLanguage();
	const id = useId();
	return (
		<div className="flex items-center gap-1.5 text-xs text-faint">
			<LanguageIcon className="size-3.5" />
			<label htmlFor={id} className="sr-only">
				{t("userMenu.language")}
			</label>
			<select
				id={id}
				value={language}
				onChange={(event) => void changeLanguage(event.target.value)}
				className="cursor-pointer rounded-sm border border-line bg-card px-1.5 py-0.5 text-xs text-muted hover:text-text"
			>
				{PICKER_LANGUAGES.map((code) => (
					<option key={code} value={code} lang={code}>
						{languageName(code)}
					</option>
				))}
			</select>
		</div>
	);
}
