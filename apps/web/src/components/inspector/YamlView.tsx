import { getNodeSource, type WidgetNode } from "@glaze/core";
import { useEditor } from "../../store/editor-store.ts";

export interface YamlViewProps {
	readonly widget: WidgetNode;
}

/**
 * The selected widget's YAML, exactly as it is in the file. Read-only for now.
 * @param props - The selected widget.
 * @returns The code block.
 */
export function YamlView({ widget }: YamlViewProps) {
	const doc = useEditor((state) => state.doc);
	const source = doc ? getNodeSource(doc, widget.path) : null;
	if (source === null) {
		return (
			<p className="text-sm text-muted">This widget's YAML can't be shown.</p>
		);
	}
	// `doc` comes from the store, so this updates right after every form edit.
	return (
		<>
			<pre
				tabIndex={0}
				aria-label="Widget YAML"
				aria-describedby="yaml-view-note"
				className="overflow-x-auto rounded-md border border-line bg-card p-3 font-mono text-xs leading-relaxed text-text"
			>
				<code>{source}</code>
			</pre>
			<p id="yaml-view-note" className="mt-2 text-xs text-faint">
				Read-only for now. Editing YAML arrives with the code view.
			</p>
		</>
	);
}
