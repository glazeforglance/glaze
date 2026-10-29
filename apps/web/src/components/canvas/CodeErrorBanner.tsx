import { useEditor } from "../../store/editor-store.ts";
import { useTranslation } from "react-i18next";
import { parseErrorText } from "../../lib/messages.ts";

/**
 * Tells the user that the YAML typed in the Code view doesn't parse, so
 * Design still shows (and can't edit) the last valid version.
 * @returns The banner, or nothing while the YAML is valid.
 */
export function CodeErrorBanner() {
	const { t } = useTranslation();
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
					{t("canvas.codeError.title")}
				</span>{" "}
				{parseErrorText(codeError)}
			</p>
			<button
				type="button"
				onClick={() => setView("code")}
				className="cursor-pointer rounded-sm px-2 font-semibold text-text hover:underline"
			>
				{t("canvas.codeError.open")}
			</button>
		</div>
	);
}
