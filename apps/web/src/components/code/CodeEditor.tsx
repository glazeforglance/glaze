import {
	type CodeMirrorOptions,
	useCodeMirror,
} from "../../hooks/use-codemirror.ts";

/**
 * A CodeMirror editor that fills its container. All logic lives in `useCodeMirror`.
 * @param props - Editor options (text, callbacks, diagnostics, highlight).
 * @returns The editor element.
 */
export function CodeEditor(props: CodeMirrorOptions) {
	const { containerRef } = useCodeMirror(props);
	// Code reads left to right in every UI language.
	return (
		<div
			ref={containerRef}
			dir="ltr"
			className="h-full min-h-0 overflow-hidden"
		/>
	);
}
