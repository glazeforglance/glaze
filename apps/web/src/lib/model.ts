import type { PageNode, WidgetNode, YamlPath } from "@glaze/core";
import { i18n } from "../i18n.ts";
import {
	type BadgeTone,
	badgeToneFor,
	catalogEntry,
} from "./widget-catalog.ts";

/** Searches head widgets, columns and nested children, in display order. */
function findOnPage(
	page: PageNode,
	matches: (widget: WidgetNode) => boolean,
): WidgetNode | null {
	const search = (widgets: readonly WidgetNode[]): WidgetNode | null => {
		for (const widget of widgets) {
			if (matches(widget)) return widget;
			const child = search(widget.children);
			if (child) return child;
		}
		return null;
	};
	return (
		search(page.headWidgets) ??
		page.columns.reduce<WidgetNode | null>(
			(found, column) => found ?? search(column.widgets),
			null,
		)
	);
}

/**
 * Finds a widget anywhere on a page: head widgets, columns and nested children.
 * @param page - The page to search.
 * @param id - The widget's Glaze id.
 * @returns The widget, or `null` when it isn't on this page.
 */
export function findWidget(page: PageNode, id: string): WidgetNode | null {
	return findOnPage(page, (widget) => widget.id === id);
}

/**
 * Finds the widget at a YAML path on a page.
 * @param page - The page to search.
 * @param path - Path of the widget, e.g. `["pages", 0, "columns", 1, "widgets", 2]`.
 * @returns The widget, or `null` when no widget on this page has that path.
 */
export function findWidgetByPath(
	page: PageNode,
	path: YamlPath,
): WidgetNode | null {
	const key = JSON.stringify(path);
	return findOnPage(page, (widget) => JSON.stringify(widget.path) === key);
}

/**
 * Finds the group or split-column a widget is in.
 * @param page - The page the widget is on.
 * @param widget - The widget.
 * @returns The container widget, or `null` for a widget in a column or head widgets.
 */
export function parentWidget(
	page: PageNode,
	widget: WidgetNode,
): WidgetNode | null {
	// A child sits at [...parent, "widgets", i]; a column's widget at [..., "columns", c, "widgets", i].
	return findWidgetByPath(page, widget.path.slice(0, -2));
}

/**
 * Picks a short description for a widget block, e.g. `group · 3 tabs`.
 * @param widget - The widget.
 * @returns The text shown under the widget's title.
 */
export function widgetSubtitle(widget: WidgetNode): string {
	if (widget.include !== null) return widget.include;
	// The type is a Glance option value: never translated.
	const type = widget.type ?? i18n.t("canvas.subtitle.noType");
	const count = widget.children.length;
	if (widget.type === "group") {
		return i18n.t("canvas.subtitle.tabs", { type, count });
	}
	if (widget.type === "split-column") {
		return i18n.t("canvas.subtitle.widgets", { type, count });
	}
	return widget.isAlias ? i18n.t("canvas.subtitle.alias", { type }) : type;
}

/** How a widget is shown: its title and two-letter badge. */
export interface WidgetDisplay {
	readonly title: string;
	readonly abbr: string;
	readonly tone: BadgeTone;
}

/**
 * Picks the title and badge for a widget: its own `title`, else the type's
 * name from the catalog; `$include` items get a fixed "Include".
 * @param widget - The widget.
 * @returns Title, badge text and badge color.
 */
export function widgetDisplay(widget: WidgetNode): WidgetDisplay {
	const tone = badgeToneFor(widget.type);
	if (widget.include !== null) {
		return { title: i18n.t("widget.include"), abbr: "IN", tone };
	}
	const entry = catalogEntry(widget.type);
	return { title: widget.title ?? entry.label, abbr: entry.abbr, tone };
}

/**
 * Picks a name for a new page that no page has yet: "New page", "New page 2", …
 * in the UI language (it is written to glance.yml as the page's name).
 * @param pages - The existing pages.
 * @returns An unused name.
 */
export function nextPageName(pages: readonly PageNode[]): string {
	const taken = new Set(pages.map((page) => page.name));
	const first = i18n.t("page.newName");
	if (!taken.has(first)) return first;
	let number = 2;
	while (taken.has(i18n.t("page.newNameNumbered", { number }))) number += 1;
	return i18n.t("page.newNameNumbered", { number });
}
