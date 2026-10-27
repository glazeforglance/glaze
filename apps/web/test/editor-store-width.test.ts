import { serializeConfig } from "@glaze/core";
import { describe, expect, it } from "vitest";
import {
	createEditorStore,
	selectCurrentPage,
} from "../src/store/editor-store.ts";

// Fake values only.
const CONFIG = `pages:
  - name: Home
    head-widgets:
      - type: search
    columns:
      - size: full
        widgets:
          - type: clock
            title: Klok
          - type: calendar
          # News, side by side.
          - type: split-column
            widgets:
              - type: hacker-news
              - type: lobsters
          - type: group
            widgets:
              - type: rss
`;

function setup() {
	const store = createEditorStore();
	store.getState().load(CONFIG, "v1");
	return store;
}

type Store = ReturnType<typeof setup>;

const text = (store: Store) => {
	const { doc } = store.getState();
	if (!doc) throw new Error("no document");
	return serializeConfig(doc);
};
const column = (store: Store) =>
	selectCurrentPage(store.getState())?.columns[0];
const idOf = (store: Store, index: number, child?: number) => {
	const widget = column(store)?.widgets[index];
	const found = child === undefined ? widget : widget?.children[child];
	if (!found) throw new Error("no widget there");
	return found.id;
};
const types = (store: Store) =>
	column(store)?.widgets.map((widget) =>
		widget.children.length > 0
			? `${widget.type}[${widget.children.map((child) => child.type).join(",")}]`
			: widget.type,
	);

describe("dropBeside", () => {
	it("puts a new widget from the library beside a widget and selects it", () => {
		const store = setup();
		const clock = idOf(store, 0);
		store
			.getState()
			.dropBeside({ kind: "new", widget: { type: "rss" } }, clock, "right");
		expect(types(store)).toEqual([
			"split-column[clock,rss]",
			"calendar",
			"split-column[hacker-news,lobsters]",
			"group[rss]",
		]);
		const selected = store.getState().selectedWidgetId;
		expect(selected).toBe(idOf(store, 0, 1));
	});

	it("moves a widget beside another one, keeping its id selected", () => {
		const store = setup();
		const calendar = idOf(store, 1);
		store
			.getState()
			.dropBeside({ kind: "move", widgetId: calendar }, idOf(store, 0), "left");
		expect(types(store)).toEqual([
			"split-column[calendar,clock]",
			"split-column[hacker-news,lobsters]",
			"group[rss]",
		]);
		expect(store.getState().selectedWidgetId).toBe(calendar);
	});

	it("adds to the target's split-column instead of nesting a new one", () => {
		const store = setup();
		store
			.getState()
			.dropBeside(
				{ kind: "move", widgetId: idOf(store, 0) },
				idOf(store, 2),
				"left",
			);
		expect(types(store)).toEqual([
			"calendar",
			"split-column[clock,hacker-news,lobsters]",
			"group[rss]",
		]);
	});
});

describe("moving the last-but-one widget out of a split-column", () => {
	it("dissolves the split-column, with a notice that can undo that", () => {
		const store = setup();
		const lobsters = idOf(store, 2, 1);
		const path = column(store)?.widgets[0]?.path.slice(0, -1);
		if (!path) throw new Error("no column path");
		store.getState().moveWidget(lobsters, path, 0);
		expect(types(store)).toEqual([
			"lobsters",
			"clock",
			"calendar",
			"hacker-news",
			"group[rss]",
		]);
		// The comment above the split-column moved to its remaining widget.
		expect(text(store)).toContain(
			"          # News, side by side.\n          - type: hacker-news\n",
		);
		expect(store.getState().undoNotice?.message).toMatch(/one widget left/);

		store.getState().undoFromNotice();
		expect(types(store)).toEqual([
			"lobsters",
			"clock",
			"calendar",
			"split-column[hacker-news]",
			"group[rss]",
		]);
		expect(store.getState().undoNotice).toBeNull();
	});

	it("leaves a split-column with two or more widgets alone", () => {
		const store = setup();
		store
			.getState()
			.dropBeside(
				{ kind: "new", widget: { type: "reddit" } },
				idOf(store, 2),
				"right",
			);
		const hackerNews = idOf(store, 2, 0);
		const path = column(store)?.widgets[0]?.path.slice(0, -1);
		if (!path) throw new Error("no column path");
		store.getState().moveWidget(hackerNews, path, 0);
		expect(types(store)?.[3]).toBe("split-column[lobsters,reddit]");
		expect(store.getState().undoNotice).toBeNull();
	});
});

describe("setWidgetWidth", () => {
	it("wraps a lone widget in a split-column of the chosen size", () => {
		const store = setup();
		const clock = idOf(store, 0);
		expect(store.getState().setWidgetWidth(clock, 3)).toBe(true);
		expect(types(store)?.[0]).toBe("split-column[clock]");
		expect(column(store)?.widgets[0]?.maxColumns).toBe(3);
		expect(store.getState().selectedWidgetId).toBe(clock);
	});

	it("changes the split-column's columns for a widget inside one", () => {
		const store = setup();
		store.getState().setWidgetWidth(idOf(store, 2, 0), 4);
		expect(column(store)?.widgets[2]?.maxColumns).toBe(4);
		expect(text(store)).toContain(
			"          - type: split-column\n            widgets:",
		);
		expect(text(store)).toContain("            max-columns: 4\n");
	});

	it("takes a widget out of its split-column for full width", () => {
		const store = setup();
		store.getState().setWidgetWidth(idOf(store, 2, 0), "full");
		expect(types(store)).toEqual([
			"clock",
			"calendar",
			"lobsters",
			"hacker-news",
			"group[rss]",
		]);
		expect(store.getState().undoNotice).not.toBeNull();
	});

	it("refuses widths in head widgets and groups", () => {
		const store = setup();
		const search = selectCurrentPage(store.getState())?.headWidgets[0]?.id;
		if (!search) throw new Error("no head widget");
		expect(store.getState().setWidgetWidth(search, 2)).toBe(false);
		expect(store.getState().notice).toMatch(/Head widgets can't be split/);
		expect(store.getState().setWidgetWidth(idOf(store, 3, 0), 2)).toBe(false);
		expect(store.getState().notice).toMatch(/group can't contain/);
	});
});

describe("unwrapSplit and setSplitColumns", () => {
	it("dissolves a split-column on request", () => {
		const store = setup();
		expect(store.getState().unwrapSplit(idOf(store, 2))).toBe(true);
		expect(types(store)).toEqual([
			"clock",
			"calendar",
			"hacker-news",
			"lobsters",
			"group[rss]",
		]);
		// Asked for, so no undo notice.
		expect(store.getState().undoNotice).toBeNull();
	});

	it("refuses fewer than 2 columns", () => {
		const store = setup();
		expect(store.getState().setSplitColumns(idOf(store, 2), 1)).toBe(false);
	});
});
