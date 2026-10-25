import { useId } from "react";
import { SearchIcon } from "../ui/icons.tsx";

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
	const id = useId();
	return (
		<div className="relative">
			<label htmlFor={id} className="sr-only">
				Search widgets
			</label>
			<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
			<input
				id={id}
				type="search"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder="Search widgets…"
				className="h-10 w-full rounded-sm border border-line bg-card pr-3 pl-9 text-sm text-text placeholder:text-faint focus:border-line-strong"
			/>
		</div>
	);
}
