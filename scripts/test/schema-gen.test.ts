import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Overrides } from "../../packages/schemas/src/override-types.ts";
import { analyzeBody, analyzeWidget } from "../schema-gen/analyze.ts";
import { buildSchemas, unclassified } from "../schema-gen/build.ts";
import {
	type GoFunc,
	parsePackage,
	tokenize,
	yamlKey,
} from "../schema-gen/go-parse.ts";
import { readTar } from "../schema-gen/go-source.ts";

describe("tokenize", () => {
	it("drops comments but not // inside strings, and inserts semicolons", () => {
		const tokens = tokenize('x := "https://a.b" // comment\ny := 1\n').map(
			(t) => t.text,
		);
		assert.deepEqual(tokens, [
			"x",
			":=",
			'"https://a.b"',
			";",
			"y",
			":=",
			"1",
			";",
		]);
	});

	it("keeps struct tags as raw strings", () => {
		const tokens = tokenize('A string `yaml:"a-b"`\n');
		assert.equal(tokens[2]?.kind, "rawstring");
	});
});

const SOURCE = `package glance

type durationField int

func (d *durationField) UnmarshalYAML(node *yaml.Node) error { return nil }

type widgetBase struct {
	Type  string \`yaml:"type"\`
	Title string \`yaml:"title"\`
	ID    uint64 \`yaml:"-"\`
}

type demoWidget struct {
	widgetBase \`yaml:",inline"\`
	Limit      int           \`yaml:"limit"\`
	SortBy     string        \`yaml:"sort-by"\`
	Mode       string        \`yaml:"mode"\`
	Name       string        \`yaml:"name"\`
	Timeout    durationField \`yaml:"timeout"\`
	Plain      string
	hidden     string \`yaml:"hidden"\`
	Skipped    string \`yaml:"-"\`
	Items      []struct {
		URL string \`yaml:"url"\`
	} \`yaml:"items"\`
}

const (
	modeA = "alpha"
	modeB = "beta"
)

var names = map[string]int{
	"one": 1,
	"two": 2,
}

func newWidget(widgetType string) (widget, error) {
	switch widgetType {
	case "demo", "demo-alias":
		w = &demoWidget{}
	}
	return w, nil
}

func (widget *demoWidget) initialize() error {
	widget.withTitle("Demo").withCacheDuration(30 * time.Minute)
	if widget.Limit <= 0 {
		widget.Limit = 15
	}
	s := widget.SortBy
	if s != "hot" && s != "new" {
		widget.SortBy = "hot"
	}
	switch widget.Mode {
	case modeA, modeB:
	default:
		return errors.New("bad mode")
	}
	if widget.Name == "" {
		return errors.New("name is required")
	}
	if _, ok := names[widget.Name]; !ok {
		return errors.New("unknown name")
	}
	for i := range widget.Items {
		if widget.Items[i].URL == "" {
			return fmt.Errorf("item %d has no url", i)
		}
	}
	return nil
}
`;

const pkg = parsePackage([SOURCE]);
const init = pkg.funcs.find((fn) => fn.name === "initialize") as GoFunc;

describe("parsePackage", () => {
	it("reads structs, constants, map keys, methods and the widget factory", () => {
		assert.equal(pkg.types.get("demoWidget")?.kind, "struct");
		assert.equal(pkg.consts.get("modeA"), "alpha");
		assert.deepEqual(pkg.mapKeys.get("names"), ["one", "two"]);
		assert.ok(pkg.methods.get("durationField")?.has("UnmarshalYAML"));
		assert.deepEqual(pkg.factory, [
			{ names: ["demo", "demo-alias"], struct: "demoWidget" },
		]);
	});

	it("follows yaml.v3's key rules", () => {
		const type = pkg.types.get("demoWidget");
		assert.equal(type?.kind, "struct");
		if (type?.kind !== "struct") return;
		const keys = type.fields.map((field) => yamlKey(field));
		assert.deepEqual(keys[0], { key: "widgetbase", inline: true });
		const byName = new Map(
			type.fields.map((field) => [field.name, yamlKey(field)]),
		);
		assert.deepEqual(byName.get("Plain"), { key: "plain", inline: false });
		assert.equal(byName.get("hidden"), null);
		assert.equal(byName.get("Skipped"), null);
	});
});

describe("analyzeBody", () => {
	const facts = analyzeBody(init, pkg);

	it("finds defaults, enums (also through an alias and a switch on constants) and required fields", () => {
		assert.equal(facts.get("Limit")?.default, 15);
		assert.deepEqual(facts.get("SortBy")?.options, ["hot", "new"]);
		assert.equal(facts.get("SortBy")?.default, "hot");
		assert.deepEqual(facts.get("Mode")?.options, ["alpha", "beta"]);
		assert.equal(facts.get("Name")?.required, true);
		assert.equal(facts.get("Items.URL")?.required, true);
	});

	it("reads a map lookup with `!ok` as a closed list", () => {
		assert.deepEqual(facts.get("Name")?.options, ["one", "two"]);
		assert.equal(facts.get("Name")?.allowCustom, undefined);
	});

	it("reads the widget's own title and refresh interval", () => {
		assert.deepEqual(analyzeWidget(init), {
			defaultTitle: "Demo",
			defaultCache: "30m",
		});
	});
});

const LABEL_ONLY: Overrides = {
	base: {},
	widgets: { demo: { label: "Demo" } },
	page: {},
	config: {},
};

// buildSchemas needs `page` and `config` structs; add tiny ones.
const FULL = `${SOURCE}
type page struct {
	Title string \`yaml:"name"\`
}
type config struct {
	Pages []page \`yaml:"pages"\`
}
`;

function build(overrides: Overrides, source = FULL) {
	return buildSchemas(
		{ glance: parsePackage([source]), others: new Map() },
		overrides,
		"v0.0.0",
	);
}

describe("buildSchemas", () => {
	it("builds a widget with its aliases, defaults and custom types", () => {
		const { widgets } = build({
			...LABEL_ONLY,
			widgets: { demo: { label: "Demo" } },
		});
		const [demo] = widgets;
		assert.equal(demo?.type, "demo");
		assert.deepEqual(demo?.aliases, ["demo-alias"]);
		assert.equal(demo?.defaultTitle, "Demo");
		const byKey = new Map(demo?.fields.map((field) => [field.key, field]));
		assert.equal(
			byKey.has("type"),
			false,
			"widgetBase fields are shared, not repeated",
		);
		assert.equal(byKey.get("limit")?.default, 15);
		assert.equal(byKey.get("timeout")?.kind, "duration");
		assert.equal(byKey.get("items")?.item?.fields?.[0]?.kind, "url");
	});

	it("fails on an override for a field that doesn't exist", () => {
		assert.throws(
			() =>
				build({
					...LABEL_ONLY,
					widgets: { demo: { label: "Demo", fields: { limt: {} } } },
				}),
			/Override for demo\.limt: no such field/,
		);
	});

	it("fails when an override's enum drops a value the code accepts", () => {
		assert.throws(
			() =>
				build({
					...LABEL_ONLY,
					widgets: {
						demo: {
							label: "Demo",
							fields: { "sort-by": { options: [{ value: "hot" }] } },
						},
					},
				}),
			/without "new"/,
		);
	});

	it("fails on a widget type without an override, or an override for an unknown type", () => {
		assert.throws(
			() => build({ ...LABEL_ONLY, widgets: {} }),
			/No override for widget type "demo"/,
		);
		assert.throws(
			() =>
				build({
					...LABEL_ONLY,
					widgets: { demo: { label: "Demo" }, other: { label: "X" } },
				}),
			/Glance has no such type/,
		);
	});

	it("fails on a type with its own UnmarshalYAML that isn't handled", () => {
		const source = FULL.replace(
			"type durationField int",
			"type durationField int\n\ntype oddField struct { A string }\n\nfunc (o *oddField) UnmarshalYAML(node *yaml.Node) error { return nil }",
		).replace(
			"Plain      string\n",
			'Plain      string\n\tOdd oddField `yaml:"odd"`\n',
		);
		assert.throws(
			() => build(LABEL_ONLY, source),
			/oddField .* has its own UnmarshalYAML/,
		);
	});

	it("reports fields the code compares with words but that aren't an enum yet", () => {
		const source = FULL.replace(
			"return nil\n}\n",
			'if widget.Plain == "fancy" {\n\t\treturn nil\n\t}\n\treturn nil\n}\n',
		);
		const [demo] = build(LABEL_ONLY, source).widgets;
		assert.deepEqual(unclassified(demo?.fields ?? [], "demo"), [
			"demo.plain: fancy",
		]);
	});
});

describe("readTar", () => {
	it("reads ustar files with a pax path", () => {
		const block = (name: string, size: number, type: string) => {
			const header = Buffer.alloc(512);
			header.write(name, 0);
			header.write(size.toString(8).padStart(11, "0"), 124);
			header.write(type, 156);
			return header;
		};
		const pad = (data: Buffer) =>
			Buffer.concat([data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
		const pax = Buffer.from("30 path=glance-0/internal/a.go\n");
		const body = Buffer.from("package glance\n");
		const tar = Buffer.concat([
			block("pax", pax.length, "x"),
			pad(pax),
			block("short.go", body.length, "0"),
			pad(body),
			Buffer.alloc(1024),
		]);
		const files = readTar(tar);
		assert.deepEqual(
			files.map((file) => [file.path, file.data.toString()]),
			[["glance-0/internal/a.go", "package glance\n"]],
		);
	});
});
