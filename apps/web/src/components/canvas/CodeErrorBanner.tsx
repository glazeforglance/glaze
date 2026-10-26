import { useEditor } from "../../store/editor-store.ts";

/**
 * Tells the user that the YAML typed in the Code view doesn't parse, so
 * Design still shows (and can't edit) the last valid version.
 * @returns The banner, or nothing while the YAML is valid.
 */
export function CodeErrorBanner() {
	const codeError = useEditor((state) => state.codeError);
	const setView = useEditor((state) => state.setView);
	if (codeError === null) return null;
	return (
		<div
			role="alert"
			className="mb-4 flex items-center gap-3 rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm"
		>
			<p className="flex-1">
				<span className="font-semibold text-danger">
					YAML has errors — Design shows the last valid version.
				</span>{" "}
				{codeError.line !== null && `Line ${codeError.line}: `}
				{codeError.message}
			</p>
			<button
				type="button"
				onClick={() => setView("code")}
				className="cursor-pointer rounded-sm px-2 font-semibold text-text hover:underline"
			>
				Open Code
			</button>
		</div>
	);
}
