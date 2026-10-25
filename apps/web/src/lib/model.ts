import type { PageNode, WidgetNode } from "@glaze/core";

/**
 * Finds a widget anywhere on a page: head widgets, columns and nested children.
 * @param page - The page to search.
 * @param id - The widget's Glaze id.
 * @returns The widget, or `null` when it isn't on this page.
 */
export function findWidget(page: PageNode, id: string): WidgetNode | null {
	const search = (widgets: readonly WidgetNode[]): WidgetNode | null => {
		for (const widget of widgets) {
			if (widget.id === id) return widget;
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
 * Picks a short description for a widget block, e.g. `group · 3 tabs`.
 * @param widget - The widget.
 * @returns The text shown under the widget's title.
 */
export function widgetSubtitle(widget: WidgetNode): string {
	if (widget.include !== null) return widget.include;
	const type = widget.type ?? "no type";
	const count = widget.children.length;
	if (widget.type === "group") {
		return `${type} · ${count} ${count === 1 ? "tab" : "tabs"}`;
	}
	if (widget.type === "split-column") {
		return `${type} · ${count} ${count === 1 ? "widget" : "widgets"}`;
	}
	return widget.isAlias ? `${type} · alias` : type;
}
