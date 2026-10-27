/*
 * Option names for the unknown-option tests: a hand-kept subset of what
 * Glance v0.8.7 reads. The app itself gets the full lists from
 * @glaze/schemas, which generates them from the Glance source.
 */

/** Keys of a page (`page` struct in config.go). */
export const PAGE_KEYS: readonly string[] = [
	"name",
	"slug",
	"width",
	"desktop-navigation-width",
	"show-mobile-header",
	"hide-desktop-navigation",
	"center-vertically",
	"head-widgets",
	"columns",
];

/** Keys of a column. */
export const COLUMN_KEYS: readonly string[] = ["size", "widgets"];

/** Options every widget has (`widgetBase` in widget.go). */
export const WIDGET_BASE_KEYS: readonly string[] = [
	"type",
	"title",
	"title-url",
	"hide-header",
	"css-class",
	"cache",
];

/**
 * Widget-specific options, for the widget types Glaze has a form for (plus
 * `split-column`). Types that aren't listed are not checked.
 */
export const WIDGET_TYPE_KEYS: Readonly<Record<string, readonly string[]>> = {
	bookmarks: ["groups"],
	calendar: ["first-day-of-week"],
	clock: ["hour-format", "timezones"],
	"docker-containers": [
		"hide-by-default",
		"running-only",
		"category",
		"sock-path",
		"format-container-names",
		"containers",
	],
	group: ["widgets"],
	monitor: ["style", "show-failing-only", "sites"],
	releases: [
		"repositories",
		"token",
		"gitlab-token",
		"limit",
		"collapse-after",
		"show-source-icon",
	],
	rss: [
		"feeds",
		"style",
		"thumbnail-height",
		"card-height",
		"limit",
		"collapse-after",
		"single-line-titles",
		"preserve-order",
	],
	search: [
		"search-engine",
		"bangs",
		"new-tab",
		"target",
		"autofocus",
		"placeholder",
	],
	"split-column": ["max-columns", "widgets"],
	weather: [
		"location",
		"units",
		"hour-format",
		"show-area-name",
		"hide-location",
	],
};
