import { StreamLanguage, type StringStream } from "@codemirror/language";

/*
 * A small highlighter for HTML with Go template actions (`{{ … }}`), used by
 * the html, custom-api and document head editors. CodeMirror's full HTML
 * language isn't a dependency of Glaze; this covers what those fields hold.
 */

interface TemplateState {
	/** Inside `{{ … }}`. */
	action: boolean;
	/** Inside `<tag …>`. */
	tag: boolean;
	/** Inside `<!-- … -->`. */
	comment: boolean;
}

function readAction(stream: StringStream, state: TemplateState): string | null {
	if (stream.match(/^-?\}\}/)) {
		state.action = false;
		return "brace";
	}
	if (stream.eatSpace()) return null;
	if (stream.match(/^"(?:[^"\\]|\\.)*"?/) || stream.match(/^`[^`]*`?/)) {
		return "string";
	}
	if (stream.match(/^\/\*.*?\*\//)) return "comment";
	if (stream.match(/^\$[\w]*/)) return "variableName";
	if (stream.match(/^\.[\w.]*/)) return "propertyName";
	if (stream.match(/^-?\d+(?:\.\d+)?/)) return "number";
	if (
		stream.match(
			/^(?:if|else|end|range|with|define|template|block|break|continue|and|or|not|eq|ne|lt|le|gt|ge|len|index|printf|print|println)\b/,
		)
	) {
		return "keyword";
	}
	// A template function, e.g. toRelativeTime (styled like other function names).
	if (stream.match(/^[A-Za-z_]\w*/)) return "variableName.function";
	stream.next();
	return "operator";
}

/** HTML with `{{ … }}` Go template actions. */
export const goTemplateHtml = StreamLanguage.define<TemplateState>({
	name: "go-template-html",
	startState: () => ({ action: false, tag: false, comment: false }),
	token(stream, state) {
		if (state.action) return readAction(stream, state);
		if (stream.match(/^\{\{-?/)) {
			state.action = true;
			return "brace";
		}
		if (state.comment) {
			if (stream.skipTo("-->")) {
				stream.match("-->");
				state.comment = false;
			} else {
				stream.skipToEnd();
			}
			return "comment";
		}
		if (stream.match("<!--")) {
			state.comment = true;
			return "comment";
		}
		if (state.tag) {
			if (stream.match(/^\/?>/)) {
				state.tag = false;
				return "angleBracket";
			}
			if (stream.eatSpace()) return null;
			if (stream.match(/^"[^"]*"?/) || stream.match(/^'[^']*'?/)) {
				return "attributeValue";
			}
			if (stream.match(/^[\w:-]+/)) return "attributeName";
			stream.next();
			return null;
		}
		if (stream.match(/^<\/?[\w-]+/)) {
			state.tag = true;
			return "tagName";
		}
		// Plain text up to the next tag or action.
		stream.next();
		while (!stream.eol() && !stream.match(/^(?=<|\{\{)/, false)) stream.next();
		return null;
	},
});
