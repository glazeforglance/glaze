import { useEffect } from "react";
import { useEditor } from "../../store/editor-store.ts";

/**
 * "● Unsaved changes" while the document differs from the file on disk.
 * Also asks the browser to warn before closing or reloading the tab then.
 * @returns The indicator, or nothing when everything is published.
 */
export function UnsavedIndicator() {
	const dirty = useEditor((state) => state.dirty);

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
			Unsaved changes
		</span>
	);
}
