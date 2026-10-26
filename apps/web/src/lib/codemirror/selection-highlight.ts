import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

/** A character range to highlight, e.g. the widget selected in Design. */
export interface HighlightRange {
	readonly from: number;
	readonly to: number;
}

/** Sets (or clears, with `null`) the highlighted range. */
export const setSelectionHighlight =
	StateEffect.define<HighlightRange | null>();

const lineMark = Decoration.line({ class: "cm-glaze-selected" });

function decorate(
	doc: EditorView["state"]["doc"],
	range: HighlightRange,
): DecorationSet {
	const from = Math.min(range.from, doc.length);
	const to = Math.min(range.to, doc.length);
	const marks = [];
	for (
		let line = doc.lineAt(from).number;
		line <= doc.lineAt(to).number;
		line++
	) {
		marks.push(lineMark.range(doc.line(line).from));
	}
	return Decoration.set(marks);
}

/**
 * Keeps whole-line highlights for one range. Typing maps the lines along;
 * a new `setSelectionHighlight` effect replaces them.
 */
export const selectionHighlightField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(value, transaction) {
		let next = value.map(transaction.changes);
		for (const effect of transaction.effects) {
			if (effect.is(setSelectionHighlight)) {
				next =
					effect.value === null
						? Decoration.none
						: decorate(transaction.state.doc, effect.value);
			}
		}
		return next;
	},
	provide: (field) => EditorView.decorations.from(field),
});
