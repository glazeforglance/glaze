import { serializeConfig } from "@glaze/core";
import { describe, expect, it } from "vitest";
import {
	createEditorStore,
	selectCurrentPage,
} from "../src/store/editor-store.ts";

// Fake values only. Comments, an anchor and a template must survive every edit.
const CONFIG = `pages:
  - name: Home
    columns:
      - size: small
        widgets:
          # The clock comes first.
          - type: clock
            title: Klok
          - &weather
            type: weather
            location: Amsterdam
      - size: full
        widgets:
          - type: custom-api
            title: Greeting
            template: |
              <p>{{ .JSON.String "hi" }}</p>
          - <<: *weather
            title: Weather copy
`;

const SMALL = ["pages", 0, "columns", 0, "widgets"];
const FULL = ["pages", 0, "columns", 1, "widgets"];

function setup() {
	const store = createEditorStore();
	store.getState().load(CONFIG, "v1");
	const page = selectCurrentPage(store.getState());
	const [clock, weather] = page?.columns[0]?.widgets ?? [];
	const [greeting, copy] = page?.columns[1]?.widgets ?? [];
	if (!clock || !weather || !greeting || !copy)
		throw new Error("fixture changed");
	return { store, clock, weather, greeting, copy };
}

function text(store: ReturnType<typeof setup>["store"]): string {
	const { doc } = store.getState();
	if (!doc) throw new Error("no document");
	return serializeConfig(doc);
}

function sortedLines(value: string): string[] {
	return value.split("\n").sort();
}

describe("moveWidget", () => {
	it("reorders within a column, keeping the comment with its widget", () => {
		const { store, clock } = setup();
		store.getState().moveWidget(clock.id, SMALL, 1);
		const result = text(store);
		expect(result).toContain(
			"            location: Amsterdam\n          # The clock comes first.\n          - type: clock\n",
		);
		expect(sortedLines(result)).toEqual(sortedLines(CONFIG));
		expect(store.getState()).toMatchObject({
			dirty: true,
			notice: null,
			selectedWidgetId: clock.id,
		});
	});

	it("moves between columns and keeps the widget's id", () => {
		const { store, greeting } = setup();
		store.getState().moveWidget(greeting.id, SMALL, 0);
		const page = selectCurrentPage(store.getState());
		expect(page?.columns[0]?.widgets[0]?.id).toBe(greeting.id);
		expect(page?.columns[1]?.widgets.map((w) => w.title)).toEqual([
			"Weather copy",
		]);
		expect(text(store)).toContain(
			'          - type: custom-api\n            title: Greeting\n            template: |\n              <p>{{ .JSON.String "hi" }}</p>\n',
		);
	});

	it("refuses a move that breaks the YAML and keeps the document", () => {
		const { store, weather } = setup();
		const before = store.getState().doc;
		// Putting the anchor below its alias would leave `*weather` pointing at nothing.
		store.getState().moveWidget(weather.id, FULL, 2);
		expect(store.getState().doc).toBe(before);
		expect(store.getState().dirty).toBe(false);
		expect(store.getState().notice).toMatch(/anchor/i);
		store.getState().dismissNotice();
		expect(store.getState().notice).toBeNull();
	});
});

describe("addWidget", () => {
	it("adds a minimal widget at the drop position and selects it", () => {
		const { store } = setup();
		store.getState().addWidget({ type: "rss", title: "RSS" }, FULL, 1);
		const page = selectCurrentPage(store.getState());
		const added = page?.columns[1]?.widgets[1];
		expect(added).toMatchObject({ type: "rss", title: "RSS" });
		expect(store.getState().selectedWidgetId).toBe(added?.id);
		const result = text(store);
		expect(result).toContain(
			'              <p>{{ .JSON.String "hi" }}</p>\n          - type: rss\n            title: RSS\n          - <<: *weather\n',
		);
		expect(result.split("\n").length).toBe(CONFIG.split("\n").length + 2);
	});

	it("creates head-widgets when the page has none", () => {
		const { store } = setup();
		store
			.getState()
			.addWidget(
				{ type: "search", title: "Search" },
				["pages", 0, "head-widgets"],
				0,
			);
		const page = selectCurrentPage(store.getState());
		expect(page?.headWidgets.map((w) => w.type)).toEqual(["search"]);
	});
});
