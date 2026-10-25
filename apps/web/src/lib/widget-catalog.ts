/** Library groups, in display order. */
export type WidgetGroupId = "basics" | "server" | "media" | "advanced";

/** Color of a two-letter badge; each library group has its own. */
export type BadgeTone = "accent" | "success" | "info" | "violet";

/** A library group. */
export interface WidgetGroup {
	readonly id: WidgetGroupId;
	readonly label: string;
	readonly tone: BadgeTone;
}

/** A widget type Glaze knows about. */
export interface CatalogEntry {
	readonly type: string;
	readonly label: string;
	/** Short badge text, usually two letters. */
	readonly abbr: string;
	readonly group: WidgetGroupId;
}

export const WIDGET_GROUPS: readonly WidgetGroup[] = [
	{ id: "basics", label: "Basics", tone: "accent" },
	{ id: "server", label: "Server", tone: "success" },
	{ id: "media", label: "Media & news", tone: "info" },
	{ id: "advanced", label: "Advanced", tone: "violet" },
];

// Widget types of Glance v0.8.7.
export const WIDGET_CATALOG: readonly CatalogEntry[] = [
	{ type: "clock", label: "Clock", abbr: "CL", group: "basics" },
	{ type: "weather", label: "Weather", abbr: "WE", group: "basics" },
	{ type: "calendar", label: "Calendar", abbr: "CA", group: "basics" },
	{ type: "search", label: "Search", abbr: "SE", group: "basics" },
	{ type: "bookmarks", label: "Bookmarks", abbr: "BM", group: "basics" },
	{ type: "to-do", label: "To-do", abbr: "TD", group: "basics" },
	{ type: "monitor", label: "Monitor", abbr: "MO", group: "server" },
	{
		type: "docker-containers",
		label: "Docker containers",
		abbr: "DC",
		group: "server",
	},
	{ type: "server-stats", label: "Server stats", abbr: "SS", group: "server" },
	{ type: "dns-stats", label: "DNS stats", abbr: "DN", group: "server" },
	{ type: "releases", label: "Releases", abbr: "RE", group: "server" },
	{ type: "repository", label: "Repository", abbr: "RP", group: "server" },
	{
		type: "change-detection",
		label: "Change detection",
		abbr: "CD",
		group: "server",
	},
	{ type: "rss", label: "RSS", abbr: "RS", group: "media" },
	{ type: "reddit", label: "Reddit", abbr: "RD", group: "media" },
	{ type: "hacker-news", label: "Hacker News", abbr: "HN", group: "media" },
	{ type: "lobsters", label: "Lobsters", abbr: "LO", group: "media" },
	{ type: "videos", label: "Videos", abbr: "YT", group: "media" },
	{
		type: "twitch-channels",
		label: "Twitch channels",
		abbr: "TC",
		group: "media",
	},
	{ type: "markets", label: "Markets", abbr: "MK", group: "media" },
	{ type: "custom-api", label: "Custom API", abbr: "API", group: "advanced" },
	{ type: "html", label: "HTML", abbr: "</>", group: "advanced" },
	{ type: "iframe", label: "Iframe", abbr: "IF", group: "advanced" },
	{ type: "extension", label: "Extension", abbr: "EX", group: "advanced" },
	{ type: "group", label: "Group (tabs)", abbr: "GR", group: "advanced" },
	{
		type: "split-column",
		label: "Split column",
		abbr: "SP",
		group: "advanced",
	},
];

const BY_TYPE = new Map(WIDGET_CATALOG.map((entry) => [entry.type, entry]));

/**
 * Looks up a widget type, with a generated entry for types Glaze doesn't know
 * (e.g. from a newer Glance), so every widget can still be shown.
 * @param type - The widget's `type`, or `null` when it has none.
 * @returns The catalog entry.
 */
export function catalogEntry(type: string | null): CatalogEntry {
	const known = type === null ? undefined : BY_TYPE.get(type);
	if (known) return known;
	const label = type ?? "Unknown";
	const letters = label.replace(/[^a-z0-9]/gi, "");
	return {
		type: label,
		label,
		abbr: (letters.slice(0, 2) || "??").toUpperCase(),
		group: "advanced",
	};
}

/**
 * Returns the badge color for a widget type.
 * @param type - The widget's `type`.
 * @returns The tone of the type's library group.
 */
export function badgeToneFor(type: string | null): BadgeTone {
	const { group } = catalogEntry(type);
	return WIDGET_GROUPS.find((g) => g.id === group)?.tone ?? "violet";
}

/**
 * Filters the library by a search text (matching label or type) and groups the result.
 * @param query - What the user typed; empty shows everything.
 * @returns Non-empty groups in display order, each with its matching entries.
 */
export function searchCatalog(
	query: string,
): { group: WidgetGroup; entries: CatalogEntry[] }[] {
	const needle = query.trim().toLowerCase();
	const matches = WIDGET_CATALOG.filter(
		(entry) =>
			needle === "" ||
			entry.label.toLowerCase().includes(needle) ||
			entry.type.includes(needle),
	);
	return WIDGET_GROUPS.map((group) => ({
		group,
		entries: matches.filter((entry) => entry.group === group.id),
	})).filter(({ entries }) => entries.length > 0);
}
