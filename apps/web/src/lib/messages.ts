/*
 * Sentences for problems that @glaze/core and the server report as a code
 * plus values. The English `message` they also carry is only a fallback for
 * codes this version doesn't know (a newer server), and for text that isn't
 * ours to translate: Glance's own output and the yaml package's syntax errors.
 */
import type {
	EditError,
	IssueCode,
	MessageParams,
	ParseError,
} from "@glaze/core";
import { fieldText, i18n } from "../i18n.ts";

/** Every code with a sentence under `problems` in app.json. */
type ProblemCode = Exclude<IssueCode, "missing-option" | "yaml-syntax">;

const PROBLEM_CODES: ReadonlySet<string> = new Set<ProblemCode>([
	"unresolved-alias",
	"no-pages",
	"no-columns",
	"too-many-columns",
	"invalid-column-size",
	"full-column-count",
	"nested-group",
	"split-in-head",
	"host-not-text",
	"host-is-url",
	"host-unclosed-bracket",
	"host-bad-ipv6",
	"host-ipv6-needs-brackets",
	"host-invalid",
	"port-invalid",
	"base-url-invalid",
	"listen-in-container",
	"unknown-option",
	"unknown-option-suggestion",
	"glance-validation-off",
	"glance-output",
	"glance-output-machine",
	"glance-reads-file",
	"assets-unchecked",
	"assets-path-missing",
	"glance-unrunnable",
	"glance-timeout",
	"glance-failed",
]);

const EXTRA_CODES = new Set([
	"column-needs-full",
	"column-too-many-full",
	"slug-reserved",
	"slug-taken",
]);

type ExtraCode =
	| "column-needs-full"
	| "column-too-many-full"
	| "slug-reserved"
	| "slug-taken";

function isProblemCode(code: string): code is ProblemCode | ExtraCode {
	return PROBLEM_CODES.has(code) || EXTRA_CODES.has(code);
}

/** A YAML value in a sentence: quoted as written, or "empty" when there is none. */
function withSize(params: MessageParams | undefined): MessageParams {
	const values = params ?? {};
	if (values.size === undefined) return values;
	return {
		...values,
		size:
			values.size === "" ? i18n.t("problems.emptySize") : `"${values.size}"`,
	};
}

/**
 * The sentence for a problem with a known code (a core `Problem`, a layout
 * issue, a validation issue), else its English message.
 * @param problem - A code, values and the English fallback.
 * @returns The text in the UI language.
 */
export function problemText(problem: {
	readonly code?: string;
	readonly params?: MessageParams;
	readonly message: string;
}): string {
	const { code, params, message } = problem;
	if (code === "missing-option") return missingOptionText(params ?? {});
	if (code === undefined || !isProblemCode(code)) return message;
	// A slim page has its own sentence, as Glance's rule is about the width.
	if (code === "too-many-columns" && params?.max === 2) {
		return i18n.t("problems.too-many-columns-slim", params);
	}
	return i18n.t(`problems.${code}`, withSize(params));
}

function labelOf(key: unknown, fallback: string): string {
	return typeof key === "string"
		? fieldText(`${key}.label`, fieldText(`${key}.name`, fallback))
		: fallback;
}

/** "Weather needs a value for “Location”", with labels in the UI language. */
function missingOptionText(params: MessageParams): string {
	const widget = labelOf(params.widget, "?");
	const option = labelOf(params.option, "?");
	if (params.list === undefined) {
		return i18n.t("problems.missing-option", { widget, option });
	}
	return i18n.t("problems.missing-option-in-list", {
		widget,
		option,
		list: labelOf(params.list, "?"),
		item: params.item ?? "?",
	});
}

/**
 * The sentence for a refused edit: the layout rule it would break, or a
 * short explanation per code. Paths in the English message are for developers.
 * @param error - From a core edit.
 * @returns The text in the UI language.
 */
export function editErrorText(error: EditError): string {
	const [issue] = error.issues;
	if (error.code === "layout-violation" && issue) {
		return problemText(issue);
	}
	const params = error.params ?? {};
	if (error.code === "invalid-result" && params.alias !== undefined) {
		return i18n.t("editErrors.invalid-result-alias", params);
	}
	if (error.code === "invalid-result" && params.detail !== undefined) {
		return i18n.t("editErrors.invalid-result-detail", params);
	}
	return i18n.t(`editErrors.${error.code}`, error.params ?? {});
}

/**
 * The sentence for YAML that doesn't parse, with the line when known.
 * @param error - From `parseConfig`.
 * @returns E.g. "Line 4: …"; syntax details are the yaml package's (English).
 */
export function parseErrorText(error: ParseError): string {
	const text = problemText(error);
	return error.line === null
		? text
		: i18n.t("problems.atLine", { line: error.line, text });
}
