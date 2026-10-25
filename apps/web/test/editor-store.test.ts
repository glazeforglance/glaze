import { describe, expect, it } from "vitest";
import { findWidget, widgetSubtitle } from "../src/lib/model.ts";
import {
	createEditorStore,
	selectCurrentPage,
} from "../src/store/editor-store.ts";

// Small inline config with fake values; the real one in .dev/ is never used in tests.
const CONFIG = `pages:
  - name: Home
    head-widgets:
      - type: search
    columns:
      - size: full
        widgets:
          - type: group
            widgets:
              - type: rss
              - type: reddit
          - $include: widgets/extra.yml
  - name: Server
    columns:
      - size: full
        widgets:
          - type: split-column
            widgets:
              - type: hacker-news
                title: HN
              - type: lobsters
`;

function loadedStore() {
	const store = createEditorStore();
	store.getState().load(CONFIG, "v1");
	return store;
}

describe("editor store", () => {
	it("starts in the loading state", () => {
		expect(createEditorStore().getState()).toMatchObject({
			status: "loading",
			doc: null,
		});
	});

	it("parses a config, builds the model and selects the first page", () => {
		const state = loadedStore().getState();
		expect(state).toMatchObject({
			status: "ready",
			version: "v1",
			dirty: false,
		});
		expect(state.pages.map((page) => page.name)).toEqual(["Home", "Server"]);
		expect(selectCurrentPage(state)?.name).toBe("Home");
		expect(state.selectedWidgetId).toBeNull();
	});

	it("shows a YAML error with its line number", () => {
		const store = createEditorStore();
		store.getState().load("pages:\n  - name: [\n", "v1");
		expect(store.getState().status).toBe("error");
		expect(store.getState().error).toMatch(/^Line \d+: /);
	});

	it("keeps API errors as the error message", () => {
		const store = createEditorStore();
		store.getState().fail("Can't reach the Glaze API");
		expect(store.getState()).toMatchObject({
			status: "error",
			error: "Can't reach the Glaze API",
		});
	});

	it("switches pages and clears the widget selection", () => {
		const store = loadedStore();
		const [home, server] = store.getState().pages;
		store.getState().selectWidget(home?.headWidgets[0]?.id ?? null);
		store.getState().selectPage(server?.id ?? "");
		expect(store.getState()).toMatchObject({
			selectedPageId: server?.id,
			selectedWidgetId: null,
		});
		store.getState().selectPage("does-not-exist");
		expect(store.getState().selectedPageId).toBe(server?.id);
	});
});

describe("model helpers", () => {
	const [home, server] = loadedStore().getState().pages;

	it("finds head widgets, column widgets and nested children", () => {
		if (!home || !server) throw new Error("fixture pages missing");
		const search = home.headWidgets[0];
		const reddit = home.columns[0]?.widgets[0]?.children[1];
		expect(search && findWidget(home, search.id)?.type).toBe("search");
		expect(reddit && findWidget(home, reddit.id)?.type).toBe("reddit");
		expect(reddit && findWidget(server, reddit.id)).toBeNull();
	});

	it("describes groups, split-columns and includes", () => {
		const [group, include] = home?.columns[0]?.widgets ?? [];
		const split = server?.columns[0]?.widgets[0];
		expect(group && widgetSubtitle(group)).toBe("group · 2 tabs");
		expect(split && widgetSubtitle(split)).toBe("split-column · 2 widgets");
		expect(include && widgetSubtitle(include)).toBe("widgets/extra.yml");
		expect(split?.children[0]?.title).toBe("HN");
	});
});
