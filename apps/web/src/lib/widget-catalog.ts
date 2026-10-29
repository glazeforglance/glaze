import type { WidgetInput } from "@glaze/core";
import { widgetSchema } from "@glaze/schemas";
import { i18n, localizedWidget } from "../i18n.ts";

/** Library groups, in display order. */
export type WidgetGroupId = "basics" | "server" | "media" | "advanced";

/** Color of a two-letter badge; each library group has its own. */
export type BadgeTone = "accent" | "success" | "info" | "violet";

/** A library group. */
export interface WidgetGroup {
	readonly id: WidgetGroupId;
	/** In the UI language. */
	readonly label: string;
	readonly tone: BadgeTone;
}

/** A widget type Glaze knows about, without its (translated) name. */
interface CatalogType {
	readonly type: string;
	/** Short badge text, usually two letters. */
	readonly abbr: string;
	readonly group: WidgetGroupId;
}

/** A widget type Glaze knows about. */
export interface CatalogEntry extends CatalogType {
	/** The widget's name in the UI language (from the schema texts). */
	readonly label: string;
}

const GROUPS: readonly Omit<WidgetGroup, "label">[] = [
	{ id: "basics", tone: "accent" },
	{ id: "server", tone: "success" },
	{ id: "media", tone: "info" },
	{ id: "advanced", tone: "violet" },
];

// Widget types of Glance v0.8.7 (a test checks this against @glaze/schemas).
// Names come from the schemas (overrides.ts), so they are translated with them.
const TYPES: readonly CatalogType[] = [
	{ type: "clock", abbr: "CL", group: "basics" },
	{ type: "weather", abbr: "WE", group: "basics" },
	{ type: "calendar", abbr: "CA", group: "basics" },
	{ type: "search", abbr: "SE", group: "basics" },
	{ type: "bookmarks", abbr: "BM", group: "basics" },
	{ type: "to-do", abbr: "TD", group: "basics" },
	{ type: "monitor", abbr: "MO", group: "server" },
	{ type: "docker-containers", abbr: "DC", group: "server" },
	{ type: "server-stats", abbr: "SS", group: "server" },
	{ type: "dns-stats", abbr: "DN", group: "server" },
	{ type: "releases", abbr: "RE", group: "server" },
	{ type: "repository", abbr: "RP", group: "server" },
	{ type: "change-detection", abbr: "CD", group: "server" },
	{ type: "rss", abbr: "RS", group: "media" },
	{ type: "reddit", abbr: "RD", group: "media" },
	{ type: "hacker-news", abbr: "HN", group: "media" },
	{ type: "lobsters", abbr: "LO", group: "media" },
	{ type: "videos", abbr: "YT", group: "media" },
	{ type: "twitch-channels", abbr: "TC", group: "media" },
	{ type: "twitch-top-games", abbr: "TG", group: "media" },
	{ type: "markets", abbr: "MK", group: "media" },
	{ type: "custom-api", abbr: "API", group: "advanced" },
	{ type: "html", abbr: "</>", group: "advanced" },
	{ type: "iframe", abbr: "IF", group: "advanced" },
	{ type: "extension", abbr: "EX", group: "advanced" },
	{ type: "group", abbr: "GR", group: "advanced" },
	{ type: "split-column", abbr: "SP", group: "advanced" },
	{ type: "calendar-legacy", abbr: "LC", group: "advanced" },
];

/**
 * The name of a widget type in the UI language.
 * @param type - A widget type Glance knows.
 * @returns The translated name, or the type itself for an unknown type.
 */
export function widgetName(type: string): string {
	const schema = widgetSchema(type);
	return schema ? localizedWidget(schema).label : type;
}

function withLabel(entry: CatalogType): CatalogEntry {
	return { ...entry, label: widgetName(entry.type) };
}

/**
 * The library groups, with their names in the UI language.
 * @returns The groups, in display order.
 */
export function widgetGroups(): WidgetGroup[] {
	return GROUPS.map((group) => ({
		...group,
		label: i18n.t(`library.groups.${group.id}`),
	}));
}

/**
 * Every widget type in the library, with names in the UI language.
 * @returns The entries, in library order.
 */
export function widgetCatalog(): CatalogEntry[] {
	return TYPES.map(withLabel);
}

/**
 * The options a widget from the library starts with: its type plus the
 * starting options from its schema (see `newWidget` in overrides.ts), so it
 * is valid right away. The title is left to Glance's own default.
 * @param type - The widget type.
 * @returns The widget to write.
 */
export function newWidgetOf(type: string): WidgetInput {
	return { type, ...(widgetSchema(type)?.newWidget ?? {}) };
}

const BY_TYPE = new Map(TYPES.map((entry) => [entry.type, entry]));

/**
 * Looks up a widget type, with a generated entry for types Glaze doesn't know
 * (e.g. from a newer Glance), so every widget can still be shown.
 * @param type - The widget's `type`, or `null` when it has none.
 * @returns The catalog entry.
 */
export function catalogEntry(type: string | null): CatalogEntry {
	const known = type === null ? undefined : BY_TYPE.get(type);
	if (known) return withLabel(known);
	const label = type ?? i18n.t("widget.unknownType");
	const letters = (type ?? "Unknown").replace(/[^a-z0-9]/gi, "");
	return {
		type: type ?? label,
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
	const known = type === null ? undefined : BY_TYPE.get(type);
	return GROUPS.find((g) => g.id === known?.group)?.tone ?? "violet";
}

/**
 * Filters the library by a search text (matching the translated name or the
 * type, so `docker` also works in another language) and groups the result.
 * @param query - What the user typed; empty shows everything.
 * @returns Non-empty groups in display order, each with its matching entries.
 */
export function searchCatalog(
	query: string,
): { group: WidgetGroup; entries: CatalogEntry[] }[] {
	const needle = query.trim().toLocaleLowerCase(i18n.language);
	const matches = widgetCatalog().filter(
		(entry) =>
			needle === "" ||
			entry.label.toLocaleLowerCase(i18n.language).includes(needle) ||
			entry.type.includes(needle),
	);
	return widgetGroups()
		.map((group) => ({
			group,
			entries: matches.filter((entry) => entry.group === group.id),
		}))
		.filter(({ entries }) => entries.length > 0);
}
