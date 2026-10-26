import type { Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import {
	findPathAtOffset,
	getNodeRange,
	type RenameKeyFix,
	serializeConfig,
} from "@glaze/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCodeSync } from "../../hooks/use-code-sync.ts";
import { useDraftText, useValidation } from "../../hooks/use-validation.ts";
import { placeIssues } from "../../lib/codemirror/text-sync.ts";
import { findWidget } from "../../lib/model.ts";
import {
	editorStore,
	selectCurrentPage,
	useEditor,
} from "../../store/editor-store.ts";
import { filesStore, isFileDirty, useFiles } from "../../store/files-store.ts";
import { CodeEditor } from "./CodeEditor.tsx";
import { type FileTab, FileTabs } from "./FileTabs.tsx";
import { IssueList } from "./IssueList.tsx";

/** Tab id of the config itself; asset files use their name. */
export const CONFIG_TAB = "glance.yml";

const LANGUAGE_LABEL = { yaml: "YAML", css: "CSS", javascript: "JS" } as const;
const PANEL_ID = "code-editor-panel";
const NO_DIAGNOSTICS: readonly Diagnostic[] = [];

function applyFix(fix: RenameKeyFix): void {
	editorStore.getState().renameKey(fix.mapPath, fix.from, fix.to);
}

/**
 * The code editor with its file tabs, cursor position and problem list.
 * - `glance.yml` follows the store both ways: typing is parsed after a pause,
 *   and form or drag edits flow in without moving the cursor.
 * - The widget selected in Design is highlighted and scrolled into view;
 *   moving the cursor selects the widget under it.
 * - Asset files (`custom.css`, …) are edited as text and published together.
 *
 * The panel stays mounted (hidden) outside the Code view, so the editor keeps
 * its cursor, scroll position and undo history while you work in Design.
 * @param props - `active`: whether the Code view is showing.
 * @returns The panel.
 */
export function CodePanel({ active }: { readonly active: boolean }) {
	useValidation(active);
	const draft = useDraftText() ?? "";
	const doc = useEditor((state) => state.doc);
	const codeText = useEditor((state) => state.codeText);
	const codeError = useEditor((state) => state.codeError);
	const validation = useEditor((state) => state.validation);
	const page = useEditor(selectCurrentPage);
	const selectedWidgetId = useEditor((state) => state.selectedWidgetId);
	const files = useFiles((state) => state.files);
	const filesLoaded = useFiles((state) => state.loaded);
	const unavailable = useFiles((state) => state.unavailable);
	const [tab, setTab] = useState(CONFIG_TAB);
	const [cursorLine, setCursorLine] = useState(1);
	const [scrollRequest, setScrollRequest] = useState(0);
	const viewRef = useRef<EditorView | null>(null);
	const { onChange: onConfigChange, isPending, flush } = useCodeSync();
	// The selection the cursor made last; such a selection doesn't scroll the editor.
	const cursorSelection = useRef<string | null>(null);
	// The selection when the editor last scrolled to it (or the user saw it).
	const shownSelection = useRef<string | null>(null);

	useEffect(() => {
		if (active && !filesLoaded) void filesStore.getState().load();
	}, [active, filesLoaded]);

	// Leaving the Code view applies text that is still waiting for the pause.
	useEffect(() => {
		if (!active) flush();
	}, [active, flush]);

	const activeFile = files.find((file) => file.name === tab) ?? null;
	const isConfig = activeFile === null;

	const selectedWidget =
		page && selectedWidgetId ? findWidget(page, selectedWidgetId) : null;
	const widgetPath = selectedWidget?.path;
	const pagePath = page?.path;
	const { highlight, scrollTarget } = useMemo(() => {
		if (!doc || codeText !== null)
			return { highlight: null, scrollTarget: null };
		const widgetRange = widgetPath ? getNodeRange(doc, widgetPath) : null;
		const pageRange = pagePath ? getNodeRange(doc, pagePath) : null;
		return {
			highlight: widgetRange
				? { from: widgetRange.from, to: widgetRange.to }
				: null,
			scrollTarget: (widgetRange ?? pageRange)?.from ?? null,
		};
	}, [doc, codeText, widgetPath, pagePath]);

	// Scroll to the selection the first time the view opens, and whenever Design
	// changed it in the meantime. Selections made with the cursor never scroll.
	const selectionKey = `${page?.id ?? null}:${selectedWidgetId}`;
	useEffect(() => {
		if (!active || shownSelection.current === selectionKey) return;
		shownSelection.current = selectionKey;
		if (cursorSelection.current === selectionKey) return;
		setScrollRequest((count) => count + 1);
	}, [active, selectionKey]);

	// Placed in the text they were made for; the editor applies them only to that text.
	const diagnostics = useMemo(() => {
		if (!validation) return NO_DIAGNOSTICS;
		return placeIssues(validation.issues, validation.text).map(
			({ from, to, severity, message, issue }): Diagnostic => ({
				from,
				to,
				severity,
				message,
				source: issue.source,
				actions: issue.fix
					? [
							{
								name: `Fix: ${issue.fix.to}`,
								apply: () => issue.fix && applyFix(issue.fix),
							},
						]
					: [],
			}),
		);
	}, [validation]);

	const onCursor = (offset: number, line: number) => {
		setCursorLine(line);
		if (!isConfig || isPending()) return;
		const state = editorStore.getState();
		const view = viewRef.current;
		// Offsets only mean something while the editor shows exactly the document.
		if (!state.doc || state.codeText !== null || !view) return;
		if (view.state.doc.toString() !== serializeConfig(state.doc)) return;
		const found = findPathAtOffset(state.doc, offset);
		if (!found) return;
		state.selectPath(found.path, found.kind);
		const after = editorStore.getState();
		cursorSelection.current = `${after.selectedPageId}:${after.selectedWidgetId}`;
	};

	const jumpToLine = (lineNumber: number) => {
		const view = viewRef.current;
		if (!view) return;
		const line = view.state.doc.line(
			Math.min(Math.max(lineNumber, 1), view.state.doc.lines),
		);
		const indent = line.text.length - line.text.trimStart().length;
		view.dispatch({
			selection: { anchor: line.from + indent },
			scrollIntoView: true,
		});
		view.focus();
	};

	const tabs: FileTab[] = [
		{ id: CONFIG_TAB, label: CONFIG_TAB, dirty: false },
		...files.map((file) => ({
			id: file.name,
			label: file.name,
			dirty: isFileDirty(file),
		})),
	];
	const language = activeFile ? activeFile.language : "yaml";
	const stale = !validation || validation.text !== draft;

	return (
		<section
			aria-label="Code"
			hidden={!active}
			className="min-h-0 min-w-0 flex-1 flex-col bg-bg [&:not([hidden])]:flex"
		>
			<div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
				<FileTabs
					tabs={tabs}
					active={isConfig ? CONFIG_TAB : tab}
					onSelect={setTab}
					panelId={PANEL_ID}
				/>
				<span
					className="ml-auto shrink-0 font-mono text-xs text-muted"
					aria-live="off"
				>
					line {cursorLine} · {LANGUAGE_LABEL[language]}
				</span>
			</div>
			{codeText !== null && isConfig && (
				<p
					role="status"
					className="shrink-0 border-b border-danger/40 bg-danger/10 px-4 py-2 text-sm"
				>
					<span className="font-semibold text-danger">YAML error: </span>
					{codeError && codeError.line !== null && `line ${codeError.line}: `}
					{codeError?.message}
				</p>
			)}
			{unavailable !== null && isConfig && (
				<p className="shrink-0 border-b border-line px-4 py-2 text-xs text-faint">
					Asset files can't be edited here: {unavailable}
				</p>
			)}
			{activeFile?.status === "error" ? (
				<p role="alert" className="p-4 text-sm text-danger">
					{activeFile.error}
				</p>
			) : (
				<div
					id={PANEL_ID}
					role="tabpanel"
					aria-labelledby={`file-tab-${isConfig ? CONFIG_TAB : tab}`}
					className="min-h-0 flex-1"
				>
					<CodeEditor
						docId={isConfig ? CONFIG_TAB : tab}
						label={isConfig ? CONFIG_TAB : tab}
						language={language}
						value={activeFile ? activeFile.text : draft}
						onChange={
							activeFile
								? (text) => filesStore.getState().setText(activeFile.name, text)
								: onConfigChange
						}
						onCursor={onCursor}
						diagnostics={isConfig ? diagnostics : NO_DIAGNOSTICS}
						diagnosticsFor={isConfig ? (validation?.text ?? null) : null}
						highlight={isConfig ? highlight : null}
						scrollRequest={isConfig ? scrollRequest : 0}
						scrollTarget={scrollTarget}
						onView={(view) => {
							viewRef.current = view;
						}}
					/>
				</div>
			)}
			{isConfig && (
				<IssueList
					issues={validation?.issues ?? []}
					stale={stale}
					onJump={jumpToLine}
					onFix={codeText === null && !stale ? applyFix : null}
				/>
			)}
		</section>
	);
}
