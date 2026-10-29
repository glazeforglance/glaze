import { useId } from "react";
import { SearchIcon } from "../ui/icons.tsx";
import { useTranslation } from "react-i18next";

export interface LibrarySearchProps {
	readonly value: string;
	readonly onChange: (value: string) => void;
}

/**
 * Search field that filters the widget library.
 * @param props - Current text and change handler.
 * @returns The labelled input.
 */
export function LibrarySearch({ value, onChange }: LibrarySearchProps) {
	const { t } = useTranslation();
	const id = useId();
	return (
		<div className="relative">
			<label htmlFor={id} className="sr-only">
				{t("library.searchLabel")}
			</label>
			<SearchIcon className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-faint" />
			<input
				id={id}
				type="search"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={t("library.searchPlaceholder")}
				dir="auto"
				className="h-10 w-full rounded-sm border border-line bg-card pe-3 ps-9 text-sm text-text placeholder:text-faint focus:border-line-strong"
			/>
		</div>
	);
}
