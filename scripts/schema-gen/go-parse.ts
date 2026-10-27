// A small parser for the parts of Go that describe Glance's config: type
// declarations (structs with their yaml tags), constants, package-level map
// literals, and method bodies (for defaults and checks in initialize()).
// It is not a full Go parser; it only has to read the Glance source.
//
// Runs on plain Node (built-in type stripping), so only erasable TypeScript here.

/** A lexical token. Strings keep their quotes; `\n` tokens are inserted semicolons. */
export interface Token {
	readonly kind: "ident" | "number" | "string" | "rawstring" | "char" | "op";
	readonly text: string;
}

const OPERATORS = [
	"<<=",
	">>=",
	"&^=",
	"...",
	"&&",
	"||",
	"<-",
	"++",
	"--",
	"==",
	"!=",
	"<=",
	">=",
	":=",
	"+=",
	"-=",
	"*=",
	"/=",
	"%=",
	"&=",
	"|=",
	"^=",
	"<<",
	">>",
	"&^",
];

// Go inserts a semicolon at a line end after these (the Go spec, "Semicolons").
const SEMICOLON_AFTER_KEYWORD = new Set([
	"break",
	"continue",
	"fallthrough",
	"return",
]);

function endsStatement(token: Token | undefined): boolean {
	if (!token) return false;
	if (token.kind === "op") {
		return ["++", "--", ")", "]", "}"].includes(token.text);
	}
	if (token.kind === "ident") {
		return true; // keywords other than the four above never end a line in this source
	}
	return true;
}

/**
 * Splits Go source into tokens, dropping comments and inserting semicolons
 * at line ends the way the Go compiler does.
 * @param source - Go source text.
 * @returns The tokens.
 */
export function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	const pushSemicolon = () => {
		const last = tokens[tokens.length - 1];
		if (
			last &&
			(endsStatement(last) || SEMICOLON_AFTER_KEYWORD.has(last.text)) &&
			last.text !== ";"
		) {
			tokens.push({ kind: "op", text: ";" });
		}
	};
	while (i < source.length) {
		const ch = source[i] as string;
		if (ch === "\n") {
			pushSemicolon();
			i += 1;
		} else if (ch === " " || ch === "\t" || ch === "\r") {
			i += 1;
		} else if (source.startsWith("//", i)) {
			const end = source.indexOf("\n", i);
			i = end === -1 ? source.length : end;
		} else if (source.startsWith("/*", i)) {
			const end = source.indexOf("*/", i + 2);
			const comment = source.slice(i, end === -1 ? source.length : end);
			if (comment.includes("\n")) pushSemicolon();
			i = end === -1 ? source.length : end + 2;
		} else if (ch === '"') {
			let j = i + 1;
			while (j < source.length && source[j] !== '"') {
				j += source[j] === "\\" ? 2 : 1;
			}
			tokens.push({ kind: "string", text: source.slice(i, j + 1) });
			i = j + 1;
		} else if (ch === "`") {
			const end = source.indexOf("`", i + 1);
			tokens.push({ kind: "rawstring", text: source.slice(i, end + 1) });
			i = end + 1;
		} else if (ch === "'") {
			let j = i + 1;
			while (j < source.length && source[j] !== "'") {
				j += source[j] === "\\" ? 2 : 1;
			}
			tokens.push({ kind: "char", text: source.slice(i, j + 1) });
			i = j + 1;
		} else if (/[A-Za-z_]/.test(ch)) {
			let j = i + 1;
			while (j < source.length && /[A-Za-z0-9_]/.test(source[j] as string)) {
				j += 1;
			}
			tokens.push({ kind: "ident", text: source.slice(i, j) });
			i = j;
		} else if (/[0-9]/.test(ch)) {
			let j = i + 1;
			while (j < source.length && /[0-9A-Za-z_.]/.test(source[j] as string)) {
				j += 1;
			}
			tokens.push({ kind: "number", text: source.slice(i, j) });
			i = j;
		} else {
			const op = OPERATORS.find((candidate) => source.startsWith(candidate, i));
			const text = op ?? ch;
			tokens.push({ kind: "op", text });
			i += text.length;
		}
	}
	pushSemicolon();
	return tokens;
}

/** A Go type expression. */
export type GoType =
	| {
			readonly kind: "name";
			/** Package qualifier, e.g. `template` in `template.HTML`. */
			readonly pkg: string | null;
			readonly name: string;
			/** Generic type arguments, e.g. `[string, *themeProperties]`. */
			readonly args: readonly GoType[];
	  }
	| { readonly kind: "pointer"; readonly elem: GoType }
	| { readonly kind: "slice"; readonly elem: GoType }
	| { readonly kind: "array"; readonly elem: GoType }
	| { readonly kind: "map"; readonly key: GoType; readonly value: GoType }
	| { readonly kind: "struct"; readonly fields: readonly GoField[] }
	| { readonly kind: "interface" }
	| { readonly kind: "other"; readonly text: string };

/** A struct field. */
export interface GoField {
	readonly name: string;
	readonly type: GoType;
	/** The raw struct tag without backticks, or `null`. */
	readonly tag: string | null;
	readonly embedded: boolean;
}

/** A method or function with its body as normalized token text. */
export interface GoFunc {
	/** Receiver type name (without `*`), or `null` for a plain function. */
	readonly receiverType: string | null;
	readonly receiverName: string | null;
	readonly name: string;
	/** Body tokens joined by single spaces, e.g. `if w . Limit <= 0 { ... }`. */
	readonly body: string;
}

/** What the parser found in one Go package. */
export interface GoPackage {
	readonly types: Map<string, GoType>;
	/** Method names per receiver type. */
	readonly methods: Map<string, Set<string>>;
	readonly funcs: GoFunc[];
	/** String constants: name → value. */
	readonly consts: Map<string, string>;
	/** Keys of package-level map literals with string keys: var name → keys. */
	readonly mapKeys: Map<string, string[]>;
	/** Every switch/case of the widget factory: type names → struct name. */
	readonly factory: { readonly names: string[]; readonly struct: string }[];
}

/**
 * Turns a Go string literal into its value (enough for the Glance source).
 * @param literal - A quoted or raw string token.
 * @returns The string value.
 */
export function unquote(literal: string): string {
	if (literal.startsWith("`")) return literal.slice(1, -1);
	return JSON.parse(literal) as string;
}

class Cursor {
	readonly tokens: Token[];
	index = 0;
	constructor(tokens: Token[]) {
		this.tokens = tokens;
	}
	peek(offset = 0): Token | undefined {
		return this.tokens[this.index + offset];
	}
	is(text: string, offset = 0): boolean {
		return this.peek(offset)?.text === text;
	}
	next(): Token {
		const token = this.tokens[this.index];
		if (!token) throw new Error("Unexpected end of Go source");
		this.index += 1;
		return token;
	}
	expect(text: string): void {
		const token = this.next();
		if (token.text !== text) {
			throw new Error(`Expected "${text}" but found "${token.text}"`);
		}
	}
	/** Skips a balanced group starting at an opening bracket. */
	skipGroup(): void {
		const open = this.next().text;
		const close = open === "{" ? "}" : open === "(" ? ")" : "]";
		let depth = 1;
		while (depth > 0) {
			const text = this.next().text;
			if (text === open) depth += 1;
			else if (text === close) depth -= 1;
		}
	}
	skipSemicolons(): void {
		while (this.is(";")) this.index += 1;
	}
}

/** Parses a type expression at the cursor. */
function parseType(c: Cursor): GoType {
	const token = c.peek();
	if (!token) throw new Error("Expected a type");
	if (token.text === "*") {
		c.next();
		return { kind: "pointer", elem: parseType(c) };
	}
	if (token.text === "[") {
		c.next();
		if (c.is("]")) {
			c.next();
			return { kind: "slice", elem: parseType(c) };
		}
		while (!c.is("]")) c.next();
		c.next();
		return { kind: "array", elem: parseType(c) };
	}
	if (token.text === "map") {
		c.next();
		c.expect("[");
		const key = parseType(c);
		c.expect("]");
		return { kind: "map", key, value: parseType(c) };
	}
	if (token.text === "struct") {
		c.next();
		return { kind: "struct", fields: parseStructBody(c) };
	}
	if (token.text === "interface") {
		c.next();
		c.skipGroup();
		return { kind: "interface" };
	}
	if (token.text === "func" || token.text === "chan") {
		// Not used in config structs; skip to the end of the field.
		const parts: string[] = [];
		let depth = 0;
		while (!(depth === 0 && (c.is(";") || c.is("}")))) {
			const text = c.next().text;
			if (text === "(" || text === "[" || text === "{") depth += 1;
			if (text === ")" || text === "]" || text === "}") depth -= 1;
			parts.push(text);
		}
		return { kind: "other", text: parts.join(" ") };
	}
	if (token.kind === "ident") {
		c.next();
		let pkg: string | null = null;
		let name = token.text;
		if (c.is(".")) {
			c.next();
			pkg = name;
			name = c.next().text;
		}
		if (name === "any") return { kind: "interface" };
		const args: GoType[] = [];
		// `Name[` after a type name starts generic arguments.
		if (c.is("[")) {
			c.next();
			while (!c.is("]")) {
				args.push(parseType(c));
				if (c.is(",")) c.next();
			}
			c.next();
		}
		return { kind: "name", pkg, name, args };
	}
	throw new Error(`Unexpected "${token.text}" in a type`);
}

/** Parses `{ fields }` of a struct type. */
function parseStructBody(c: Cursor): GoField[] {
	c.expect("{");
	const fields: GoField[] = [];
	c.skipSemicolons();
	while (!c.is("}")) {
		const first = c.peek();
		if (!first) throw new Error("Unclosed struct");
		const isEmbedded =
			first.text === "*" ||
			(first.kind === "ident" &&
				(c.is(";", 1) ||
					c.peek(1)?.kind === "rawstring" ||
					c.peek(1)?.kind === "string" ||
					c.is("}", 1) ||
					(c.is(".", 1) &&
						(c.is(";", 3) ||
							c.peek(3)?.kind === "rawstring" ||
							c.is("}", 3)))));
		if (isEmbedded) {
			const type = parseType(c);
			const name = embeddedName(type);
			fields.push({ name, type, tag: readTag(c), embedded: true });
		} else {
			const names = [c.next().text];
			while (c.is(",")) {
				c.next();
				names.push(c.next().text);
			}
			const type = parseType(c);
			const tag = readTag(c);
			for (const name of names) {
				fields.push({ name, type, tag, embedded: false });
			}
		}
		c.skipSemicolons();
	}
	c.expect("}");
	return fields;
}

function embeddedName(type: GoType): string {
	if (type.kind === "pointer") return embeddedName(type.elem);
	return type.kind === "name" ? type.name : "?";
}

function readTag(c: Cursor): string | null {
	const token = c.peek();
	if (token?.kind === "rawstring" || token?.kind === "string") {
		c.next();
		return unquote(token.text);
	}
	return null;
}

/** Joins tokens into normalized text for pattern matching. */
function joinTokens(tokens: readonly Token[]): string {
	return tokens.map((token) => token.text).join(" ");
}

/**
 * Parses the Go files of one package.
 * @param files - The files' contents (`_test.go` files should be left out).
 * @returns Types, methods, function bodies, constants and map keys.
 */
export function parsePackage(files: readonly string[]): GoPackage {
	const pkg: GoPackage = {
		types: new Map(),
		methods: new Map(),
		funcs: [],
		consts: new Map(),
		mapKeys: new Map(),
		factory: [],
	};
	for (const file of files) parseFile(file, pkg);
	for (const fn of pkg.funcs) collectFactory(fn, pkg);
	return pkg;
}

function parseFile(source: string, pkg: GoPackage): void {
	const c = new Cursor(tokenize(source));
	while (c.peek()) {
		const token = c.next();
		if (token.text === "type") {
			parseTypeDecls(c, pkg);
		} else if (token.text === "func") {
			parseFunc(c, pkg);
		} else if (token.text === "const") {
			parseConsts(c, pkg);
		} else if (token.text === "var") {
			parseVars(c, pkg);
		} else if (token.text === "import") {
			if (c.is("(")) c.skipGroup();
			else c.next();
		}
	}
}

function parseTypeDecls(c: Cursor, pkg: GoPackage): void {
	const one = () => {
		const name = c.next().text;
		// Generic parameters: `orderedYAMLMap[K comparable, V any]`.
		if (c.is("[") && c.peek(1)?.kind === "ident" && !c.is("]", 1)) {
			c.skipGroup();
		}
		if (c.is("=")) c.next(); // type alias
		pkg.types.set(name, parseType(c));
	};
	if (c.is("(")) {
		c.next();
		c.skipSemicolons();
		while (!c.is(")")) {
			one();
			c.skipSemicolons();
		}
		c.next();
	} else {
		one();
	}
}

function parseFunc(c: Cursor, pkg: GoPackage): void {
	let receiverType: string | null = null;
	let receiverName: string | null = null;
	if (c.is("(")) {
		// (name *Type) or (name Type[K, V]) or (*Type)
		c.next();
		const parts: Token[] = [];
		while (!c.is(")")) parts.push(c.next());
		c.next();
		const idents = parts.filter((part) => part.kind === "ident");
		if (idents.length >= 2) {
			receiverName = idents[0]?.text ?? null;
			receiverType = idents[1]?.text ?? null;
		} else {
			receiverType = idents[0]?.text ?? null;
		}
	}
	const name = c.next().text;
	// Skip type parameters, parameters and results up to the body.
	let depth = 0;
	while (c.peek() && !(depth === 0 && c.is("{"))) {
		const text = c.next().text;
		if (text === "(" || text === "[") depth += 1;
		if (text === ")" || text === "]") depth -= 1;
		if (depth === 0 && text === ";") return; // declaration without a body
	}
	const start = c.index;
	c.skipGroup();
	const body = joinTokens(c.tokens.slice(start + 1, c.index - 1));
	if (receiverType) {
		const methods = pkg.methods.get(receiverType) ?? new Set<string>();
		methods.add(name);
		pkg.methods.set(receiverType, methods);
	}
	pkg.funcs.push({ receiverType, receiverName, name, body });
}

function parseConsts(c: Cursor, pkg: GoPackage): void {
	const one = () => {
		const parts: Token[] = [];
		let depth = 0;
		while (c.peek() && !(depth === 0 && (c.is(";") || c.is(")")))) {
			const token = c.next();
			if (token.text === "(") depth += 1;
			if (token.text === ")") depth -= 1;
			parts.push(token);
		}
		const [name] = parts;
		const value = parts[parts.length - 1];
		if (
			name?.kind === "ident" &&
			parts.some((part) => part.text === "=") &&
			(value?.kind === "string" || value?.kind === "rawstring")
		) {
			pkg.consts.set(name.text, unquote(value.text));
		}
	};
	if (c.is("(")) {
		c.next();
		c.skipSemicolons();
		while (!c.is(")")) {
			one();
			c.skipSemicolons();
		}
		c.next();
	} else {
		one();
	}
}

function parseVars(c: Cursor, pkg: GoPackage): void {
	if (c.is("(")) {
		c.skipGroup();
		return;
	}
	const name = c.next();
	if (!c.is("=") || !c.is("map", 1)) {
		skipStatement(c);
		return;
	}
	c.next();
	parseType(c);
	if (!c.is("{")) {
		skipStatement(c);
		return;
	}
	// Keys of `map[string]T{ "key": value, ... }` at the top level of the literal.
	c.next();
	const keys: string[] = [];
	let depth = 0;
	let atItemStart = true;
	while (c.peek() && !(depth === 0 && c.is("}"))) {
		const token = c.next();
		if (token.text === "{" || token.text === "(" || token.text === "[") {
			depth += 1;
		} else if (token.text === "}" || token.text === ")" || token.text === "]") {
			depth -= 1;
		} else if (depth === 0 && atItemStart && token.kind === "string") {
			if (c.is(":")) keys.push(unquote(token.text));
		}
		atItemStart = depth === 0 && (token.text === "," || token.text === ";");
		if (depth === 0 && token.text === "{") atItemStart = true;
	}
	c.next();
	if (keys.length > 0) pkg.mapKeys.set(name.text, keys);
}

/** Skips to the end of a statement (e.g. `var x = func() {...}()`), brackets included. */
function skipStatement(c: Cursor): void {
	let depth = 0;
	while (c.peek() && !(depth === 0 && c.is(";"))) {
		const text = c.next().text;
		if (text === "{" || text === "(" || text === "[") depth += 1;
		if (text === "}" || text === ")" || text === "]") depth -= 1;
	}
}

/** Reads `case "a", "b": w = &someWidget{}` from the widget factory. */
function collectFactory(fn: GoFunc, pkg: GoPackage): void {
	if (fn.name !== "newWidget") return;
	const pattern = /case ((?:"[^"]*" , )*"[^"]*") : \w+ = & (\w+) \{ \}/g;
	for (const match of fn.body.matchAll(pattern)) {
		const names = [...(match[1] ?? "").matchAll(/"([^"]*)"/g)].map(
			(name) => name[1] ?? "",
		);
		pkg.factory.push({ names, struct: match[2] ?? "" });
	}
}

/**
 * Reads the yaml.v3 key of a struct field, following yaml.v3's rules: a tag
 * name wins; `-` skips the field; no name means the lowercased field name;
 * `,inline` merges the field's own fields into the parent.
 * @param field - A struct field.
 * @returns The key and whether it is inlined, or `null` when yaml.v3 ignores it.
 */
export function yamlKey(
	field: GoField,
): { readonly key: string; readonly inline: boolean } | null {
	const exported = /^[A-Z]/.test(field.name);
	// yaml.v3 skips unexported fields, except embedded ones (they can be inlined).
	if (!exported && !field.embedded) return null;
	const match = field.tag ? /(?:^|\s)yaml:"([^"]*)"/.exec(field.tag) : null;
	const [name = "", ...flags] = (match?.[1] ?? "").split(",");
	if (name === "-") return null;
	const inline = flags.includes("inline");
	if (!exported && !inline) return null;
	return { key: name === "" ? field.name.toLowerCase() : name, inline };
}
