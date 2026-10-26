import { getWidgetOptions, serializeConfig, type YamlPath } from "@glaze/core";
import { describe, expect, it } from "vitest";
// The core fixture: comments, anchors, merge keys, block scalars, ${ENV}, an include.
import FULL_FIXTURE from "../../../packages/core/test/fixtures/glance.full.yml?raw";
import { planCommit } from "../src/forms/commit.ts";
import { valueAt } from "../src/forms/paths.ts";
import { optionValues } from "../src/forms/use-widget-form.ts";
import { createEditorStore } from "../src/store/editor-store.ts";

const CLOCK = ["pages", 0, "columns", 0, "widgets", 0];
const BOOKMARKS = ["pages", 0, "columns", 2, "widgets", 0];
const MONITOR = ["pages", 1, "columns", 0, "widgets", 0];
const DOCKER = ["pages", 1, "columns", 0, "widgets", 1];

/**
 * Commits one field the way `useWidgetField` does: plan against the current
 * document, then the matching store action.
 */
function commitField(
	store: ReturnType<typeof createEditorStore>,
	widgetPath: YamlPath,
	subPath: YamlPath,
	next: unknown,
	glanceDefault?: unknown,
): void {
	const state = store.getState();
	if (!state.doc) throw new Error("no document");
	const options = getWidgetOptions(state.doc, widgetPath);
	if (!options.ok) throw new Error(options.error.message);
	const values = optionValues(options.value.options);
	const plan = planCommit({
		current: valueAt(values, subPath),
		next,
		glanceDefault,
	});
	const page = state.pages[Number(widgetPath[1])];
	// Like the inspector: only widgets on the open page can be edited.
	if (page) state.selectPage(page.id);
	const widget = [
		...(page?.columns.flatMap((column) => column.widgets) ?? []),
	].find(
		(candidate) =>
			JSON.stringify(candidate.path) === JSON.stringify(widgetPath),
	);
	if (!widget) throw new Error("widget not found");
	const [key] = subPath;
	if (plan.kind === "none") return;
	const applied =
		subPath.length === 1 && typeof key === "string"
			? plan.kind === "set"
				? state.setWidgetOption(widget.id, key, plan.value)
				: state.removeWidgetOption(widget.id, key)
			: plan.kind === "set"
				? state.setWidgetValue(widget.id, subPath, plan.value)
				: state.removeWidgetValue(widget.id, subPath);
	if (!applied) throw new Error(store.getState().notice ?? "refused");
}

describe("form edits on the full fixture", () => {
	it("change only the edited lines", () => {
		const store = createEditorStore();
		store.getState().load(FULL_FIXTURE, "v1");

		// A monitor site URL (with a trailing comment), a bookmark link inside a
		// flow map, a new clock title, a toggle, and two edits that write nothing.
		commitField(store, MONITOR, ["sites", 1, "url"], "https://komga.lan.test");
		commitField(
			store,
			BOOKMARKS,
			["groups", 0, "links", 1, "url"],
			"https://radarr.lan.test",
		);
		commitField(store, CLOCK, ["title"], "Klok");
		commitField(store, DOCKER, ["hide-by-default"], true, false);
		commitField(store, CLOCK, ["hour-format"], "24h", "24h");
		commitField(store, MONITOR, ["css-class"], "");

		const { doc } = store.getState();
		if (!doc) throw new Error("no document");
		const expected = FULL_FIXTURE.replace(
			"url: https://komga.example.test   # behind the tunnel",
			"url: https://komga.lan.test   # behind the tunnel",
		)
			.replace(
				'{ title: Radarr, url: "https://radarr.example.test" }',
				'{ title: Radarr, url: "https://radarr.lan.test" }',
			)
			.replace(
				"                label: Thuis\n",
				"                label: Thuis\n            title: Klok\n",
			)
			.replace("hide-by-default: false", "hide-by-default: true");
		expect(serializeConfig(doc)).toBe(expected);
	});
});
