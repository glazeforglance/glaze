import { serializeConfig } from "@glaze/core";
import { describe, expect, it } from "vitest";
import { nextPageName } from "../src/lib/model.ts";
import {
	createEditorStore,
	selectCurrentPage,
} from "../src/store/editor-store.ts";

// Fake values only.
const CONFIG = `pages:
  # Start page.
  - name: Home
    columns:
      - size: small
        widgets:
          - type: clock
            title: Klok
      - size: full
        widgets:
          - &rss
            type: rss
            limit: 5
          - <<: *rss
            title: More news
  - name: Lab
    width: slim
    columns:
      - size: full
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
const names = (store: Store) => store.getState().pages.map((page) => page.name);
const current = (store: Store) => selectCurrentPage(store.getState());

describe("pages", () => {
	it("adds a page, opens it and starts renaming", () => {
		const store = setup();
		store.getState().addPage();
		const state = store.getState();
		expect(names(store)).toEqual(["Home", "Lab", "New page"]);
		expect(current(store)?.name).toBe("New page");
		expect(state.renamingPageId).toBe(state.selectedPageId);
		expect(state.dirty).toBe(true);
		expect(
			text(store).endsWith(
				"  - name: New page\n    columns:\n      - size: full\n",
			),
		).toBe(true);
	});

	it("renames a page and ends renaming; an empty name is refused", () => {
		const store = setup();
		const home = store.getState().pages[0];
		if (!home) throw new Error("fixture changed");
		store.getState().startRename(home.id);
		store.getState().renamePage(home.id, "   ");
		expect(store.getState().notice).toBe("A page needs a name.");
		expect(names(store)).toEqual(["Home", "Lab"]);
		store.getState().renamePage(home.id, "  Start ");
		expect(names(store)).toEqual(["Start", "Lab"]);
		expect(store.getState().renamingPageId).toBeNull();
		expect(text(store)).toContain("  # Start page.\n  - name: Start\n");
	});

	it("removes a page and opens its neighbour", () => {
		const store = setup();
		const lab = store.getState().pages[1];
		if (!lab) throw new Error("fixture changed");
		store.getState().selectPage(lab.id);
		store.getState().removePage(lab.id);
		expect(names(store)).toEqual(["Home"]);
		expect(current(store)?.name).toBe("Home");
	});

	it("refuses to remove the last page", () => {
		const store = setup();
		const [home, lab] = store.getState().pages;
		if (!home || !lab) throw new Error("fixture changed");
		store.getState().removePage(lab.id);
		const before = store.getState().doc;
		store.getState().removePage(home.id);
		expect(store.getState().doc).toBe(before);
		expect(store.getState().notice).toMatch(/at least one page/);
	});

	it("moves a page and keeps it open", () => {
		const store = setup();
		const lab = store.getState().pages[1];
		if (!lab) throw new Error("fixture changed");
		store.getState().selectPage(lab.id);
		store.getState().movePage(lab.id, 0);
		expect(names(store)).toEqual(["Lab", "Home"]);
		expect(current(store)?.id).toBe(lab.id);
	});

	it("names new pages without clashes", () => {
		const pages = setup().getState().pages;
		expect(nextPageName(pages)).toBe("New page");
		const named = (name: string) =>
			({ ...pages[0], name }) as (typeof pages)[0];
		expect(nextPageName([named("New page"), named("New page 2")])).toBe(
			"New page 3",
		);
	});
});

describe("columns", () => {
	it("adds a small column at the end", () => {
		const store = setup();
		store.getState().addColumn("small");
		expect(current(store)?.columns.map((c) => c.size)).toEqual([
			"small",
			"full",
			"small",
		]);
	});

	it("refuses a column that breaks a layout rule, with a notice", () => {
		const store = setup();
		const lab = store.getState().pages[1];
		if (!lab) throw new Error("fixture changed");
		store.getState().selectPage(lab.id);
		store.getState().addColumn("small");
		const before = store.getState().doc;
		// A slim page can have at most 2 columns.
		store.getState().addColumn("small");
		expect(store.getState().doc).toBe(before);
		expect(store.getState().notice).toBe(
			"A slim page can have at most 2 columns",
		);
	});

	it("switches the size, refusing a page without a full column", () => {
		const store = setup();
		const [small, full] = current(store)?.columns ?? [];
		if (!small || !full) throw new Error("fixture changed");
		store.getState().setColumnSize(small.id, "full");
		expect(current(store)?.columns.map((c) => c.size)).toEqual([
			"full",
			"full",
		]);
		store.getState().setColumnSize(small.id, "small");
		store.getState().setColumnSize(full.id, "small");
		expect(store.getState().notice).toMatch(/1 or 2 "full" columns/);
		expect(current(store)?.columns.map((c) => c.size)).toEqual([
			"small",
			"full",
		]);
	});

	it("removes a column with its widgets", () => {
		const store = setup();
		const small = current(store)?.columns[0];
		if (!small) throw new Error("fixture changed");
		store.getState().removeColumn(small.id);
		expect(current(store)?.columns.map((c) => c.size)).toEqual(["full"]);
		expect(text(store)).not.toContain("Klok");
	});
});

describe("widgets", () => {
	it("duplicates a widget and selects the copy", () => {
		const store = setup();
		const copy = current(store)?.columns[1]?.widgets[1];
		if (!copy) throw new Error("fixture changed");
		store.getState().duplicateWidget(copy.id);
		const widgets = current(store)?.columns[1]?.widgets ?? [];
		expect(widgets.map((w) => w.title)).toEqual([
			null,
			"More news",
			"More news",
		]);
		expect(store.getState().selectedWidgetId).toBe(widgets[2]?.id);
		// The copy is written out in full, so it doesn't depend on the anchor.
		expect(text(store)).toContain(
			"          - type: rss\n            limit: 5\n            title: More news\n",
		);
	});

	it("removes a widget and clears the selection", () => {
		const store = setup();
		const clock = current(store)?.columns[0]?.widgets[0];
		if (!clock) throw new Error("fixture changed");
		store.getState().selectWidget(clock.id);
		store.getState().removeWidget(clock.id);
		expect(current(store)?.columns[0]?.widgets).toEqual([]);
		expect(store.getState().selectedWidgetId).toBeNull();
	});

	it("refuses to remove an anchor that is still used", () => {
		const store = setup();
		const anchored = current(store)?.columns[1]?.widgets[0];
		if (!anchored) throw new Error("fixture changed");
		const before = store.getState().doc;
		store.getState().removeWidget(anchored.id);
		expect(store.getState().doc).toBe(before);
		expect(store.getState().notice).toMatch(/anchor/i);
	});
});

describe("publishing state", () => {
	it("marks the document clean with the new version", () => {
		const store = setup();
		store.getState().addColumn("small");
		store.getState().markPublished("v2");
		expect(store.getState()).toMatchObject({ dirty: false, version: "v2" });
	});

	it("reload keeps the open page by position and drops local changes", () => {
		const store = setup();
		const lab = store.getState().pages[1];
		if (!lab) throw new Error("fixture changed");
		store.getState().selectPage(lab.id);
		store.getState().addColumn("small");
		store.getState().load(CONFIG, "v3");
		expect(current(store)?.name).toBe("Lab");
		expect(current(store)?.columns).toHaveLength(1);
		expect(store.getState()).toMatchObject({ dirty: false, version: "v3" });
	});
});
