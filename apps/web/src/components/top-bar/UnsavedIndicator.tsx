import { useEffect } from "react";
import { useHasUnsavedChanges } from "../../hooks/use-unsaved.ts";
import { useTranslation } from "react-i18next";

/**
 * "● Unsaved changes" while the document differs from the file on disk.
 * Also asks the browser to warn before closing or reloading the tab then.
 * @returns The indicator, or nothing when everything is published.
 */
export function UnsavedIndicator() {
	const { t } = useTranslation();
	const dirty = useHasUnsavedChanges();

	useEffect(() => {
		if (!dirty) return;
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);

	if (!dirty) return null;
	return (
		<span className="inline-flex items-center gap-1.5 text-sm text-muted">
			<span aria-hidden="true" className="size-2 rounded-full bg-accent" />
			{t("topBar.unsaved")}
		</span>
	);
}
