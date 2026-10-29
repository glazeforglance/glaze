import { getNodeSource, type WidgetNode } from "@glaze/core";
import { useEditor } from "../../store/editor-store.ts";
import { useTranslation } from "react-i18next";

export interface YamlViewProps {
	readonly widget: WidgetNode;
}

/**
 * The selected widget's YAML, exactly as it is in the file. Read-only for now.
 * @param props - The selected widget.
 * @returns The code block.
 */
export function YamlView({ widget }: YamlViewProps) {
	const { t } = useTranslation();
	const doc = useEditor((state) => state.doc);
	const setView = useEditor((state) => state.setView);
	const source = doc ? getNodeSource(doc, widget.path) : null;
	if (source === null) {
		return (
			<p className="text-sm text-muted">{t("inspector.yaml.unavailable")}</p>
		);
	}
	// `doc` comes from the store, so this updates right after every form edit.
	return (
		<>
			<pre
				tabIndex={0}
				aria-label={t("inspector.yaml.label")}
				dir="ltr"
				aria-describedby="yaml-view-note"
				className="overflow-x-auto rounded-md border border-line bg-card p-3 font-mono text-xs leading-relaxed text-text"
			>
				<code>{source}</code>
			</pre>
			<p id="yaml-view-note" className="mt-2 text-xs text-faint">
				{t("inspector.yaml.readOnly")}{" "}
				<button
					type="button"
					onClick={() => setView("code")}
					className="cursor-pointer text-muted underline hover:text-text"
				>
					{t("inspector.yaml.edit")}
				</button>
			</p>
		</>
	);
}
