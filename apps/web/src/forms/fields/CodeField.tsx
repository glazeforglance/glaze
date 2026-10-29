import { css } from "@codemirror/lang-css";
import { syntaxHighlighting } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { CodeLanguage } from "@glaze/schemas";
import { basicSetup } from "codemirror";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { goTemplateHtml } from "../../lib/codemirror/template-language.ts";
import {
	glazeEditorTheme,
	glazeHighlightStyle,
} from "../../lib/codemirror/theme.ts";
import { cspNonce } from "../../lib/csp.ts";
import { useWidgetField } from "../use-widget-form.ts";
import { displayText } from "./field-styles.ts";
import { FieldShell } from "./FieldShell.tsx";

export interface CodeFieldProps {
	readonly name: string;
	readonly label: string;
	readonly language?: CodeLanguage;
	readonly hint?: ReactNode;
}

function languageOf(language: CodeLanguage | undefined): Extension {
	return language === "css" ? css() : goTemplateHtml;
}

/**
 * Code in a small CodeMirror editor: HTML, a Go template, or CSS. Writes when
 * the editor loses focus, like the text fields, so one visit is one edit.
 * A value from the document replaces the text only while the editor isn't
 * focused, so typing is never interrupted.
 * @param props - Field name, label and language.
 * @returns The field element.
 */
export function CodeField({ name, label, language, hint }: CodeFieldProps) {
	const id = useId();
	const widgetField = useWidgetField(name);
	const { field, error, disabled } = widgetField;
	const value = displayText(field.value);
	const container = useRef<HTMLDivElement | null>(null);
	const view = useRef<EditorView | null>(null);
	// The latest commit function, for the editor's blur handler.
	const commit = useRef(widgetField.commit);
	useEffect(() => {
		commit.current = widgetField.commit;
	});

	useEffect(() => {
		const parent = container.current;
		if (!parent) return;
		const editor = new EditorView({
			parent,
			state: EditorState.create({
				doc: value,
				extensions: [
					basicSetup,
					languageOf(language),
					glazeEditorTheme,
					syntaxHighlighting(glazeHighlightStyle),
					EditorView.lineWrapping,
					// Code is always left to right, whatever the UI language.
					EditorView.editorAttributes.of({ dir: "ltr" }),
					EditorView.cspNonce.of(cspNonce()),
					EditorView.contentAttributes.of({
						"aria-labelledby": `${id}-label`,
						"aria-describedby": `${id}-hint`,
					}),
					EditorView.domEventHandlers({
						blur: (_event, current) => {
							commit.current(current.state.doc.toString());
						},
					}),
				],
			}),
		});
		view.current = editor;
		return () => {
			editor.destroy();
			view.current = null;
		};
		// The editor is created once per field; value updates are applied below.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [language, id]);

	useEffect(() => {
		const editor = view.current;
		if (!editor || editor.hasFocus) return;
		const current = editor.state.doc.toString();
		if (current !== value) {
			editor.dispatch({
				changes: { from: 0, to: current.length, insert: value },
			});
		}
	}, [value]);

	useEffect(() => {
		view.current?.contentDOM.setAttribute("contenteditable", String(!disabled));
	}, [disabled]);

	return (
		<FieldShell
			name={name}
			inputId={id}
			label={label}
			asGroup
			status={widgetField.status}
			env={widgetField.env}
			error={error}
			hint={hint}
			readOnly={widgetField.readOnly}
			onOverride={widgetField.override}
		>
			<div
				ref={container}
				className={`max-h-96 min-h-28 overflow-auto rounded-sm border bg-bg ${
					error ? "border-danger" : "border-line"
				} [&_.cm-editor]:min-h-28`}
			/>
		</FieldShell>
	);
}
