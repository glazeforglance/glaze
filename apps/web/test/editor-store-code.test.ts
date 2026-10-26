import { serializeConfig } from "@glaze/core";
import { describe, expect, it } from "vitest";
import { findWidget } from "../src/lib/model.ts";
import {
	createEditorStore,
	selectCurrentPage,
} from "../src/store/editor-store.ts";
import type { AssetContent } from "../src/lib/api.ts";
import { createFilesStore, isFileDirty } from "../src/store/files-store.ts";

// Small inline config with fake values; the real one in .dev/ is never used in tests.
const CONFIG = `pages:
  - name: Home   # first page
    columns:
      - size: full
        widgets:
          - type: clock
          - type: monitor
            title: Services
  - name: Server
    columns:
      - size: full
        widgets:
          - type: rss
`;

function loadedStore() {
	const store = createEditorStore();
	store.getState().load(CONFIG, "v1");
	return store;
}

function monitorId(store: ReturnType<typeof loadedStore>): string {
	const page = selectCurrentPage(store.getState());
	const widget = page?.columns[0]?.widgets[1];
	if (!widget) throw new Error("no monitor");
	return widget.id;
}

describe("editor store: code view", () => {
	it("starts in Design without code errors", () => {
		expect(loadedStore().getState()).toMatchObject({
			view: "design",
			codeText: null,
			codeError: null,
			publishCount: 0,
		});
	});

	it("switches views", () => {
		const store = loadedStore();
		store.getState().setView("code");
		expect(store.getState().view).toBe("code");
	});

	it("applies valid code and keeps the selection", () => {
		const store = loadedStore();
		const id = monitorId(store);
		store.getState().selectWidget(id);
		const text = CONFIG.replace("title: Services", "title: Diensten");
		store.getState().applyCode(text);
		const state = store.getState();
		expect(serializeConfig(state.doc ?? (null as never))).toBe(text);
		expect(state.dirty).toBe(true);
		expect(state.selectedWidgetId).toBe(id);
		const page = selectCurrentPage(state);
		expect(page && findWidget(page, id)?.title).toBe("Diensten");
	});

	it("clears the selection when its widget is gone", () => {
		const store = loadedStore();
		store.getState().selectWidget(monitorId(store));
		store
			.getState()
			.applyCode(
				CONFIG.replace(
					"          - type: monitor\n            title: Services\n",
					"",
				),
			);
		expect(store.getState().selectedWidgetId).toBeNull();
	});

	it("keeps broken YAML aside and leaves the document alone", () => {
		const store = loadedStore();
		const before = store.getState().doc;
		const broken = CONFIG.replace(
			"            title: Services",
			"           title: Services",
		);
		store.getState().applyCode(broken);
		const state = store.getState();
		expect(state.doc).toBe(before);
		expect(state.codeText).toBe(broken);
		expect(state.codeError?.line).toBe(8);
	});

	it("refuses Design edits while the code has errors, then recovers", () => {
		const store = loadedStore();
		store.getState().applyCode("pages: [\n");
		expect(
			store.getState().setWidgetOption(monitorId(store), "title", "X"),
		).toBe(false);
		expect(store.getState().notice).toContain("Code view");
		store.getState().applyCode(CONFIG);
		expect(store.getState().codeText).toBeNull();
		expect(
			store.getState().setWidgetOption(monitorId(store), "title", "X"),
		).toBe(true);
	});

	it("selects the page and widget at a path", () => {
		const store = loadedStore();
		store
			.getState()
			.selectPath(["pages", 1, "columns", 0, "widgets", 0], "widget");
		const state = store.getState();
		const page = selectCurrentPage(state);
		expect(page?.name).toBe("Server");
		expect(state.selectedWidgetId).toBe(page?.columns[0]?.widgets[0]?.id);
		store.getState().selectPath(["pages", 0], "page");
		expect(selectCurrentPage(store.getState())?.name).toBe("Home");
		expect(store.getState().selectedWidgetId).toBeNull();
	});

	it("renames a key as one edit", () => {
		const store = loadedStore();
		store
			.getState()
			.applyCode(CONFIG.replace("title: Services", "titel: Services"));
		const path = ["pages", 0, "columns", 0, "widgets", 1];
		expect(store.getState().renameKey(path, "titel", "title")).toBe(true);
		expect(serializeConfig(store.getState().doc ?? (null as never))).toBe(
			CONFIG,
		);
	});

	it("counts publishes for the preview", () => {
		const store = loadedStore();
		store.getState().markPublished("v2");
		expect(store.getState()).toMatchObject({ publishCount: 1, dirty: false });
	});
});

describe("files store", () => {
	it("tracks unsaved changes per file", () => {
		const store = createFilesStore();
		store.getState().setFiles(
			{
				files: [
					{ name: "custom.css", language: "css" },
					{ name: "broken.js", language: "javascript" },
				],
				unavailable: null,
			},
			new Map<string, AssetContent | string>([
				["custom.css", { text: "a{}", version: "v1" }],
				["broken.js", "Not UTF-8"],
			]),
		);
		const [css, js] = store.getState().files;
		expect(css && isFileDirty(css)).toBe(false);
		expect(js).toMatchObject({ status: "error", error: "Not UTF-8" });
		store.getState().setText("custom.css", "a{b:c}");
		expect(isFileDirty(store.getState().files[0] ?? (null as never))).toBe(
			true,
		);
		store.getState().markSaved("custom.css", "a{b:c}", "v2");
		expect(store.getState().files[0]).toMatchObject({ version: "v2" });
		expect(isFileDirty(store.getState().files[0] ?? (null as never))).toBe(
			false,
		);
	});
});
