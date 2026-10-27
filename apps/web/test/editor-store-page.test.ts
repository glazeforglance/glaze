import { serializeConfig } from "@glaze/core";
import { describe, expect, it } from "vitest";
import { mapTarget } from "../src/forms/use-widget-form.ts";
import {
	createEditorStore,
	editorStore,
	selectCurrentPage,
} from "../src/store/editor-store.ts";

// Fake values only.
const CONFIG = `server:
  port: 8080 # keep this comment
pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: clock
      - size: small
      - size: small
`;

function setup() {
	const store = createEditorStore();
	store.getState().load(CONFIG, "v1");
	return store;
}

const text = (store: ReturnType<typeof setup>) => {
	const { doc } = store.getState();
	if (!doc) throw new Error("no document");
	return serializeConfig(doc);
};

describe("page settings", () => {
	it("opens instead of a widget, and closes when a widget is selected", () => {
		const store = setup();
		const clock = selectCurrentPage(store.getState())?.columns[0]?.widgets[0];
		if (!clock) throw new Error("no clock");
		store.getState().selectWidget(clock.id);
		store.getState().openPageSettings();
		expect(store.getState()).toMatchObject({
			pageSettingsOpen: true,
			selectedWidgetId: null,
		});
		store.getState().selectWidget(clock.id);
		expect(store.getState().pageSettingsOpen).toBe(false);
	});

	it("writes page options as small edits", () => {
		const store = setup();
		const page = selectCurrentPage(store.getState());
		if (!page) throw new Error("no page");
		expect(
			store.getState().setValueAt(page.path, ["center-vertically"], true),
		).toBe(true);
		expect(text(store)).toContain("  - name: Home\n    columns:");
		expect(text(store)).toContain("    center-vertically: true\n");
	});

	it("refuses a slim width for a page with three columns, with Glance's rule", () => {
		const store = setup();
		const page = selectCurrentPage(store.getState());
		if (!page) throw new Error("no page");
		expect(store.getState().setValueAt(page.path, ["width"], "slim")).toBe(
			false,
		);
		expect(store.getState().notice).toBe(
			"A slim page can have at most 2 columns",
		);
	});

	it("edits top-level sections through a form target, comments included", () => {
		editorStore.getState().load(CONFIG, "v1");
		const target = mapTarget(() => []);
		expect(target.values()?.server).toEqual({ port: 8080 });
		expect(target.set(["server", "port"], 8081)).toBe(true);
		expect(text(editorStore)).toContain("  port: 8081 # keep this comment\n");
		expect(target.set(["branding", "hide-footer"], true)).toBe(true);
		expect(text(editorStore)).toContain("branding:\n  hide-footer: true\n");
		expect(target.remove(["branding", "hide-footer"])).toBe(true);
	});

	it("adds a Glance user with a hash and a secret key, as the Login section does", () => {
		editorStore.getState().load(CONFIG, "v1");
		const target = mapTarget(() => []);
		const hash = "$2a$10$abcdefghijklmnopqrstuuMd7SCiNe0Y6s1MbUCl0bk0KOFk9nGla";
		expect(
			target.set(["auth", "users", "anna"], { "password-hash": hash }),
		).toBe(true);
		expect(target.set(["auth", "secret-key"], "c2VjcmV0")).toBe(true);
		expect(
			text(editorStore).endsWith(
				`auth:\n  users:\n    anna:\n      password-hash: ${hash}\n  secret-key: c2VjcmV0\n`,
			),
		).toBe(true);
		expect(target.rename(["auth", "users"], "anna", "annie")).toBe(true);
		expect(text(editorStore)).toContain("    annie:\n      password-hash:");
	});
});
