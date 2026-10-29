import type { PageNode } from "@glaze/core";
import { useEffect, useRef, useState } from "react";
import { useEditor } from "../../store/editor-store.ts";
import { useTranslation } from "react-i18next";

export interface PageNameInputProps {
	readonly page: PageNode;
}

/**
 * Inline field that replaces a page tab while it is renamed.
 * Enter or leaving the field saves; Escape cancels.
 * @param props - The page being renamed.
 * @returns The labelled text field.
 */
export function PageNameInput({ page }: PageNameInputProps) {
	const { t } = useTranslation();
	const [value, setValue] = useState(page.name ?? "");
	const renamePage = useEditor((state) => state.renamePage);
	const cancelRename = useEditor((state) => state.cancelRename);
	const inputRef = useRef<HTMLInputElement>(null);
	// Escape and Enter both end editing; the blur that follows must not save again.
	const done = useRef(false);

	useEffect(() => {
		inputRef.current?.select();
	}, []);

	const save = () => {
		if (done.current) return;
		done.current = true;
		renamePage(page.id, value);
	};

	return (
		<input
			ref={inputRef}
			aria-label={t("pages.nameLabel")}
			dir="auto"
			value={value}
			onChange={(event) => setValue(event.target.value)}
			onBlur={save}
			onKeyDown={(event) => {
				if (event.key === "Enter") save();
				if (event.key === "Escape") {
					done.current = true;
					cancelRename();
				}
			}}
			size={Math.max(value.length, 6)}
			className="min-h-9 rounded-sm border border-accent bg-bg px-3 text-sm font-semibold text-text outline-none"
		/>
	);
}
