import { HighlightStyle } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

// Colors are the design tokens from index.css, so the editor follows the app.
const BG = "var(--color-bg)";
const CARD = "var(--color-card)";
const LINE = "var(--color-line)";
const LINE_STRONG = "var(--color-line-strong)";
const TEXT = "var(--color-text)";
const MUTED = "var(--color-muted)";
const FAINT = "var(--color-faint)";
const ACCENT = "var(--color-accent)";
const DANGER = "var(--color-danger)";
const SUCCESS = "var(--color-success)";
const INFO = "var(--color-info)";
const VIOLET = "var(--color-violet)";

/** The editor chrome: background, gutters, cursor, selection, panels and tooltips. */
export const glazeEditorTheme = EditorView.theme(
	{
		"&": {
			height: "100%",
			backgroundColor: BG,
			color: TEXT,
			fontSize: "13px",
		},
		"&.cm-focused": { outline: "none" },
		".cm-scroller": {
			fontFamily: "var(--font-mono)",
			lineHeight: "1.7",
		},
		".cm-content": { caretColor: ACCENT, padding: "12px 0" },
		".cm-cursor, .cm-dropCursor": { borderLeftColor: ACCENT },
		".cm-gutters": {
			backgroundColor: BG,
			color: FAINT,
			border: "none",
		},
		".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 16px" },
		".cm-activeLine": { backgroundColor: "rgb(255 255 255 / 0.025)" },
		".cm-activeLineGutter": { backgroundColor: "transparent", color: MUTED },
		"&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
			{ backgroundColor: "rgb(245 181 74 / 0.22)" },
		".cm-selectionMatch": { backgroundColor: "rgb(245 181 74 / 0.12)" },
		".cm-matchingBracket, .cm-nonmatchingBracket": {
			backgroundColor: "rgb(255 255 255 / 0.08)",
			outline: `1px solid ${LINE_STRONG}`,
		},
		".cm-foldPlaceholder": {
			backgroundColor: CARD,
			border: `1px solid ${LINE}`,
			color: MUTED,
		},
		// The widget selected in Design.
		".cm-glaze-selected": { backgroundColor: "rgb(245 181 74 / 0.06)" },
		".cm-searchMatch": {
			backgroundColor: "rgb(108 182 255 / 0.18)",
			outline: `1px solid rgb(108 182 255 / 0.4)`,
		},
		".cm-searchMatch.cm-searchMatch-selected": {
			backgroundColor: "rgb(245 181 74 / 0.3)",
		},
		".cm-panels": {
			backgroundColor: CARD,
			color: TEXT,
			borderColor: LINE,
		},
		".cm-panels.cm-panels-top": { borderBottom: `1px solid ${LINE}` },
		".cm-panels.cm-panels-bottom": { borderTop: `1px solid ${LINE}` },
		".cm-panel input, .cm-panel button, .cm-textfield": {
			fontFamily: "var(--font-sans)",
			fontSize: "13px",
		},
		".cm-textfield": {
			backgroundColor: BG,
			border: `1px solid ${LINE_STRONG}`,
			borderRadius: "6px",
			color: TEXT,
		},
		".cm-button": {
			backgroundImage: "none",
			backgroundColor: BG,
			border: `1px solid ${LINE_STRONG}`,
			borderRadius: "6px",
			color: TEXT,
		},
		".cm-tooltip": {
			backgroundColor: CARD,
			border: `1px solid ${LINE_STRONG}`,
			borderRadius: "8px",
			color: TEXT,
		},
		".cm-tooltip-autocomplete > ul > li[aria-selected]": {
			backgroundColor: "rgb(245 181 74 / 0.18)",
			color: TEXT,
		},
		".cm-diagnostic": { fontFamily: "var(--font-sans)", padding: "6px 10px" },
		".cm-diagnostic-error": { borderLeft: `3px solid ${DANGER}` },
		".cm-diagnostic-warning": { borderLeft: `3px solid ${ACCENT}` },
		".cm-diagnostic-info": { borderLeft: `3px solid ${INFO}` },
		".cm-diagnosticAction": {
			backgroundColor: ACCENT,
			color: "var(--color-accent-ink)",
			borderRadius: "6px",
			fontWeight: "600",
		},
		".cm-lintRange-error": {
			backgroundImage: "none",
			textDecoration: `underline wavy ${DANGER}`,
			textUnderlineOffset: "3px",
		},
		".cm-lintRange-warning": {
			backgroundImage: "none",
			textDecoration: `underline wavy ${ACCENT}`,
			textUnderlineOffset: "3px",
		},
		".cm-lintRange-info": { backgroundImage: "none" },
		".cm-gutter-lint": { width: "12px" },
	},
	{ dark: true },
);

/** Token colors: keys blue, strings green, numbers/booleans amber, comments faint. */
export const glazeHighlightStyle = HighlightStyle.define([
	{ tag: [tags.propertyName, tags.definition(tags.propertyName)], color: INFO },
	{
		tag: [tags.string, tags.special(tags.string), tags.content],
		color: SUCCESS,
	},
	{
		tag: [tags.number, tags.bool, tags.null, tags.atom, tags.unit],
		color: ACCENT,
	},
	{ tag: tags.comment, color: FAINT, fontStyle: "italic" },
	{
		tag: [tags.keyword, tags.typeName, tags.labelName, tags.modifier],
		color: VIOLET,
	},
	{ tag: [tags.className, tags.tagName], color: ACCENT },
	{ tag: [tags.function(tags.variableName), tags.attributeName], color: INFO },
	{ tag: [tags.variableName, tags.name], color: TEXT },
	{
		tag: [tags.punctuation, tags.separator, tags.operator, tags.meta],
		color: MUTED,
	},
	{ tag: tags.invalid, color: DANGER },
]);
