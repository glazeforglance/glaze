// Lists user-visible text that doesn't go through t(): JSX text, and string
// literals in attributes people see or hear. Run from apps/web:
//   node scripts/find-literals.ts
// Exits 1 when something is found that isn't in ALLOWED.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = join(import.meta.dirname, "..", "src");

/** Attributes whose value is shown or read aloud. */
const VISIBLE = new Set([
	"title",
	"aria-label",
	"aria-valuetext",
	"aria-roledescription",
	"alt",
	"placeholder",
	"label",
	"hint",
	"text",
	"confirmLabel",
	"addLabel",
	"keyLabel",
	"defaultLabel",
	"unavailable",
	"notice",
	"buttonLabel",
	"customPlaceholder",
	"keyPlaceholder",
]);

/**
 * Text that is the same in every language, with the reason. Matched against
 * the trimmed literal.
 */
const ALLOWED: ReadonlyMap<string, string> = new Map([
	["glaze", "the product name in the logo"],
	["glance.yml", "a file name"],
	["Glaze v", "product name before the version number"],
	["GLANCE_URL=http://localhost:8080", "a config line to copy"],
	["https://…", "a URL placeholder"],
	["https://", "a URL placeholder"],
	["#rrggbb", "a hex color format"],
	["jellyfin", "an example container name"],
	["Aa", "the rename icon (a symbol, not a word)"],
	["$include:", "YAML"],
	["type:", "YAML"],
]);

function files(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return files(path);
		return /\.tsx?$/.test(entry.name) ? [path] : [];
	});
}

/** True for the first argument of `t(…)` / `i18n.t(…)` (a key, not text). */
function isTranslationKey(node: ts.Node): boolean {
	const call = node.parent;
	return (
		ts.isCallExpression(call) &&
		call.arguments[0] === node &&
		/(^|\.)t$/.test(call.expression.getText())
	);
}

const found: string[] = [];
const allowed: string[] = [];

function report(file: string, node: ts.Node, text: string, kind: string) {
	const trimmed = text.trim();
	if (!/[A-Za-z]{2,}/.test(trimmed)) return;
	const source = node.getSourceFile();
	const { line } = source.getLineAndCharacterOfPosition(node.getStart());
	const where = `${relative(ROOT, file).replaceAll("\\", "/")}:${line + 1}`;
	const reason = ALLOWED.get(trimmed);
	if (reason) allowed.push(`${where}  ${kind} "${trimmed}" — ${reason}`);
	else found.push(`${where}  ${kind} "${trimmed}"`);
}

for (const file of files(ROOT)) {
	const source = ts.createSourceFile(
		file,
		readFileSync(file, "utf8"),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);
	const visit = (node: ts.Node) => {
		if (ts.isJsxText(node)) report(file, node, node.text, "text");
		if (ts.isJsxAttribute(node) && VISIBLE.has(node.name.getText())) {
			const value = node.initializer;
			if (value && ts.isStringLiteral(value)) {
				report(file, value, value.text, node.name.getText());
			}
			if (
				value &&
				ts.isJsxExpression(value) &&
				value.expression &&
				(ts.isStringLiteral(value.expression) ||
					ts.isNoSubstitutionTemplateLiteral(value.expression))
			) {
				report(file, value, value.expression.text, node.name.getText());
			}
		}
		// `{"..."}` and template text directly inside JSX.
		if (
			ts.isJsxExpression(node) &&
			node.expression &&
			ts.isStringLiteral(node.expression) &&
			(ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
		) {
			report(file, node, node.expression.text, "text");
		}
		// Sentences anywhere else (notices, errors, announcements): a capital,
		// a word, a space and a lower-case word, like "Can't reach the API".
		if (
			(ts.isStringLiteral(node) ||
				ts.isNoSubstitutionTemplateLiteral(node) ||
				ts.isTemplateHead(node)) &&
			/^[A-Z][a-z'’]+ [a-z]/.test(node.text) &&
			!ts.isImportDeclaration(node.parent) &&
			!isTranslationKey(node)
		) {
			report(file, node, node.text, "sentence");
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
}

for (const line of allowed) console.log(`allowed  ${line}`);
for (const line of found) console.log(`LITERAL  ${line}`);
console.log(
	`\n${found.length} hard-coded string(s), ${allowed.length} allowed exception(s).`,
);
process.exit(found.length > 0 ? 1 : 0);
