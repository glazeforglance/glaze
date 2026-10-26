import { serializeConfig } from "@glaze/core";
import { describe, expect, it } from "vitest";
import {
	createEditorStore,
	selectCurrentPage,
} from "../src/store/editor-store.ts";

// Fake values only.
const CONFIG = `defaults:
  site: &site
    same-tab: true

pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: monitor
            title: Services   # shown above the list
            sites:
              # Photos
              - title: Immich
                url: https://immich.example.test
              - <<: *site
                title: Komga
                url: https://komga.example.test
`;

function setup() {
	const store = createEditorStore();
	store.getState().load(CONFIG, "v1");
	const monitor = selectCurrentPage(store.getState())?.columns[0]?.widgets[0];
	if (!monitor) throw new Error("fixture changed");
	return { store, monitor };
}

function text(store: ReturnType<typeof setup>["store"]): string {
	const { doc } = store.getState();
	if (!doc) throw new Error("no document");
	return serializeConfig(doc);
}

describe("option actions", () => {
	it("sets a top-level option in place and keeps the widget selected", () => {
		const { store, monitor } = setup();
		store.getState().selectWidget(monitor.id);
		expect(
			store.getState().setWidgetOption(monitor.id, "title", "Diensten"),
		).toBe(true);
		expect(text(store)).toContain(
			"            title: Diensten   # shown above the list\n",
		);
		expect(store.getState().dirty).toBe(true);
		expect(store.getState().selectedWidgetId).toBe(monitor.id);
		expect(
			selectCurrentPage(store.getState())?.columns[0]?.widgets[0]?.id,
		).toBe(monitor.id);
	});

	it("removes a top-level option", () => {
		const { store, monitor } = setup();
		expect(store.getState().removeWidgetOption(monitor.id, "title")).toBe(true);
		expect(text(store)).not.toContain("title: Services");
	});

	it("edits a nested value", () => {
		const { store, monitor } = setup();
		expect(
			store
				.getState()
				.setWidgetValue(
					monitor.id,
					["sites", 0, "url"],
					"https://photos.lan.test",
				),
		).toBe(true);
		expect(text(store)).toBe(
			CONFIG.replace("https://immich.example.test", "https://photos.lan.test"),
		);
	});

	it("adds, moves and removes list items", () => {
		const { store, monitor } = setup();
		const state = () => store.getState();
		expect(
			state().insertWidgetListItem(monitor.id, ["sites"], {
				title: "Grafana",
				url: "https://grafana.example.test",
			}),
		).toBe(true);
		expect(text(store)).toContain("              - title: Grafana\n");
		expect(state().moveWidgetListItem(monitor.id, ["sites"], 2, 0)).toBe(true);
		expect(text(store)).toContain(
			"            sites:\n              - title: Grafana\n",
		);
		expect(state().removeWidgetValue(monitor.id, ["sites", 0])).toBe(true);
		expect(text(store)).toBe(CONFIG);
	});

	it("refuses an inherited value with a notice and leaves the document alone", () => {
		const { store, monitor } = setup();
		const before = store.getState().doc;
		expect(
			store
				.getState()
				.setWidgetValue(monitor.id, ["sites", 1, "same-tab"], false),
		).toBe(false);
		expect(store.getState().doc).toBe(before);
		expect(store.getState().dirty).toBe(false);
		expect(store.getState().notice).toMatch(/merge key/);
	});

	it("treats a move to the same place as a no-op", () => {
		const { store, monitor } = setup();
		expect(
			store.getState().moveWidgetListItem(monitor.id, ["sites"], 1, 1),
		).toBe(true);
		expect(store.getState().dirty).toBe(false);
	});

	it("keeps every widget id and the selection through a series of edits", () => {
		const { store, monitor } = setup();
		const ids = () =>
			selectCurrentPage(store.getState())?.columns.flatMap((column) =>
				column.widgets.map((widget) => widget.id),
			);
		const before = ids();
		const state = () => store.getState();
		state().selectWidget(monitor.id);
		state().setWidgetOption(monitor.id, "title", "Diensten");
		state().insertWidgetListItem(monitor.id, ["sites"], {
			url: "https://grafana.example.test",
		});
		state().moveWidgetListItem(monitor.id, ["sites"], 2, 0);
		state().setWidgetValue(monitor.id, ["sites", 0, "title"], "Grafana");
		state().removeWidgetValue(monitor.id, ["sites", 0]);
		state().removeWidgetOption(monitor.id, "title");
		expect(ids()).toEqual(before);
		expect(state().selectedWidgetId).toBe(monitor.id);
	});

	it("returns false for an unknown widget", () => {
		const { store } = setup();
		expect(store.getState().setWidgetOption("widget-999", "title", "x")).toBe(
			false,
		);
	});
});
