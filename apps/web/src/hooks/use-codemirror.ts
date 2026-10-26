import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { yaml } from "@codemirror/lang-yaml";
import { syntaxHighlighting } from "@codemirror/language";
import { type Diagnostic, lintGutter, setDiagnostics } from "@codemirror/lint";
import { Annotation, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import {
	type HighlightRange,
	selectionHighlightField,
	setSelectionHighlight,
} from "../lib/codemirror/selection-highlight.ts";
import { minimalChange } from "../lib/codemirror/text-sync.ts";
import { cspNonce } from "../lib/csp.ts";
import {
	glazeEditorTheme,
	glazeHighlightStyle,
} from "../lib/codemirror/theme.ts";

/** The languages the code view can show. */
export type CodeLanguage = "yaml" | "css" | "javascript";

/** Marks changes that came from outside (store, form edits), not from typing. */
const External = Annotation.define<boolean>();

// While the user typed this recently, outside text is not pushed into the editor:
// it can only be an older version of what they are typing.
const TYPING_GRACE_MS = 600;

export interface CodeMirrorOptions {
	/** Which document is shown; each one keeps its own undo history and cursor. */
	readonly docId: string;
	readonly language: CodeLanguage;
	/** The text from the store. Changes are applied without moving the cursor. */
	readonly value: string;
	/** Accessible name of the editor, e.g. "glance.yml". */
	readonly label: string;
	/** Called on every change the user makes. */
	readonly onChange: (text: string) => void;
	/** Called when the user moves the cursor (also while typing). */
	readonly onCursor?: (offset: number, line: number) => void;
	/** Receives the view once it exists (and `null` when it is destroyed). */
	readonly onView?: (view: EditorView | null) => void;
	readonly diagnostics: readonly Diagnostic[];
	/**
	 * The text `diagnostics` were made for. They are only applied while the editor
	 * shows exactly this text; otherwise CodeMirror keeps mapping the old ones.
	 */
	readonly diagnosticsFor: string | null;
	/** Lines to highlight, e.g. the widget selected in Design. */
	readonly highlight: HighlightRange | null;
	/** Changing this number scrolls `scrollTarget` into view. */
	readonly scrollRequest: number;
	readonly scrollTarget: number | null;
}

function languageExtension(language: CodeLanguage): Extension {
	if (language === "css") return css();
	if (language === "javascript") return javascript();
	return yaml();
}

/**
 * Runs a CodeMirror 6 editor inside a container element. One `EditorView` is
 * created; switching `docId` swaps in that document's saved `EditorState`, so
 * every file tab keeps its history, cursor and scroll position.
 * @param options - Document, text, callbacks, diagnostics and highlight.
 * @returns A ref for the container element.
 */
export function useCodeMirror(options: CodeMirrorOptions): {
	containerRef: RefObject<HTMLDivElement | null>;
} {
	const {
		docId,
		value,
		diagnostics,
		diagnosticsFor,
		highlight,
		scrollRequest,
	} = options;
	const containerRef = useRef<HTMLDivElement | null>(null);
	const viewRef = useRef<EditorView | null>(null);
	const states = useRef(new Map<string, EditorState>());
	const currentId = useRef<string | null>(null);
	const lastTyped = useRef(0);
	const lastEmitted = useRef<string | null>(null);
	const swap = useRef<((id: string) => void) | null>(null);
	// Latest options, so the editor never has to be rebuilt for a new callback.
	const latest = useRef(options);
	useLayoutEffect(() => {
		latest.current = options;
	});

	// Create the view once; destroy it on unmount.
	useEffect(() => {
		const parent = containerRef.current;
		if (!parent) return;
		const createState = (id: string): EditorState => {
			const { value: text, language, label } = latest.current;
			return EditorState.create({
				doc: text,
				extensions: [
					basicSetup,
					languageExtension(language),
					glazeEditorTheme,
					syntaxHighlighting(glazeHighlightStyle),
					lintGutter(),
					selectionHighlightField,
					// Lets CodeMirror's <style> elements pass the CSP (see lib/csp.ts).
					EditorView.cspNonce.of(cspNonce()),
					EditorView.contentAttributes.of({ "aria-label": `${label} source` }),
					EditorView.updateListener.of((update) => {
						const external = update.transactions.some(
							(transaction) => transaction.annotation(External) === true,
						);
						// A late update from a document that was just swapped out.
						if (external || currentId.current !== id) return;
						if (update.docChanged) {
							const text = update.state.doc.toString();
							lastTyped.current = Date.now();
							lastEmitted.current = text;
							latest.current.onChange(text);
						}
						if (update.selectionSet) {
							const head = update.state.selection.main.head;
							latest.current.onCursor?.(
								head,
								update.state.doc.lineAt(head).number,
							);
						}
					}),
				],
			});
		};
		const saved = states.current;
		const id = latest.current.docId;
		currentId.current = id;
		const view = new EditorView({ parent, state: createState(id) });
		viewRef.current = view;
		latest.current.onView?.(view);
		// Switching documents needs createState, which lives in this closure.
		swap.current = (nextId: string) => {
			if (currentId.current !== null) saved.set(currentId.current, view.state);
			currentId.current = nextId;
			lastEmitted.current = null;
			view.setState(saved.get(nextId) ?? createState(nextId));
		};
		return () => {
			saved.clear();
			swap.current = null;
			latest.current.onView?.(null);
			view.destroy();
			viewRef.current = null;
		};
	}, []);

	// Switch documents: keep the old state, restore (or create) the new one.
	useEffect(() => {
		if (currentId.current !== docId) swap.current?.(docId);
	}, [docId]);

	// Push outside changes in as one minimal edit: cursor and scroll stay put.
	useEffect(() => {
		const view = viewRef.current;
		if (!view || value === lastEmitted.current) return;
		if (Date.now() - lastTyped.current < TYPING_GRACE_MS) return;
		const change = minimalChange(view.state.doc.toString(), value);
		if (!change) return;
		view.dispatch({ changes: change, annotations: External.of(true) });
	}, [value, docId]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view || diagnosticsFor !== view.state.doc.toString()) return;
		view.dispatch(setDiagnostics(view.state, diagnostics));
	}, [diagnostics, diagnosticsFor, docId]);

	const highlightFrom = highlight?.from ?? null;
	const highlightTo = highlight?.to ?? null;
	useEffect(() => {
		viewRef.current?.dispatch({
			effects: setSelectionHighlight.of(
				highlightFrom === null || highlightTo === null
					? null
					: { from: highlightFrom, to: highlightTo },
			),
			annotations: External.of(true),
		});
	}, [highlightFrom, highlightTo, docId]);

	useEffect(() => {
		const view = viewRef.current;
		const target = latest.current.scrollTarget;
		if (!view || target === null || scrollRequest === 0) return;
		view.dispatch({
			effects: EditorView.scrollIntoView(
				Math.min(target, view.state.doc.length),
				{ y: "center" },
			),
			annotations: External.of(true),
		});
	}, [scrollRequest]);

	return { containerRef };
}
