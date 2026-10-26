import type { ComponentType } from "react";
import type { z } from "zod";
import { baseWidgetSchema } from "./schema.ts";
import type { BaseFieldKey } from "./use-widget-form.ts";
import { BookmarksSettings } from "./widgets/bookmarks.tsx";
import { bookmarksSchema } from "./widgets/bookmarks.schema.ts";
import { CalendarSettings } from "./widgets/calendar.tsx";
import { calendarSchema } from "./widgets/calendar.schema.ts";
import { ClockSettings } from "./widgets/clock.tsx";
import { clockSchema } from "./widgets/clock.schema.ts";
import {
	DockerContainersSettings,
	DockerContainersStyle,
} from "./widgets/docker-containers.tsx";
import { dockerContainersSchema } from "./widgets/docker-containers.schema.ts";
import { GroupSettings } from "./widgets/group.tsx";
import { groupSchema } from "./widgets/group.schema.ts";
import { MonitorSettings } from "./widgets/monitor.tsx";
import { monitorSchema } from "./widgets/monitor.schema.ts";
import { ReleasesSettings, ReleasesStyle } from "./widgets/releases.tsx";
import { releasesSchema } from "./widgets/releases.schema.ts";
import { RssSettings, RssStyle } from "./widgets/rss.tsx";
import { rssSchema } from "./widgets/rss.schema.ts";
import { SearchSettings } from "./widgets/search.tsx";
import { searchSchema } from "./widgets/search.schema.ts";
import { WeatherSettings, WeatherStyle } from "./widgets/weather.tsx";
import { weatherSchema } from "./widgets/weather.schema.ts";

/** The form for one widget type. */
export interface WidgetFormDefinition {
	/** Validates the widget's options; should extend `baseWidgetSchema` and allow unknown keys. */
	readonly schema: z.ZodType;
	/** Widget-specific fields for the Settings tab, shown below the shared ones. */
	readonly Settings?: ComponentType;
	/** Widget-specific fields for the Style tab, shown below the shared ones. */
	readonly Style?: ComponentType;
	/** Shared fields that Glance ignores for this type (e.g. a group's title). */
	readonly hiddenBaseFields?: readonly BaseFieldKey[];
}

/**
 * Widget type → form: the MVP widgets from docs/DESIGN.md §5. Types that
 * aren't listed get only the shared fields and a pointer to the YAML tab.
 */
const FORMS: Readonly<Record<string, WidgetFormDefinition>> = {
	bookmarks: { schema: bookmarksSchema, Settings: BookmarksSettings },
	calendar: { schema: calendarSchema, Settings: CalendarSettings },
	clock: { schema: clockSchema, Settings: ClockSettings },
	"docker-containers": {
		schema: dockerContainersSchema,
		Settings: DockerContainersSettings,
		Style: DockerContainersStyle,
	},
	group: {
		schema: groupSchema,
		Settings: GroupSettings,
		// Glance hides a group's header, so these have no effect.
		hiddenBaseFields: ["title", "title-url", "cache", "hide-header"],
	},
	monitor: { schema: monitorSchema, Settings: MonitorSettings },
	releases: {
		schema: releasesSchema,
		Settings: ReleasesSettings,
		Style: ReleasesStyle,
	},
	rss: { schema: rssSchema, Settings: RssSettings, Style: RssStyle },
	search: { schema: searchSchema, Settings: SearchSettings },
	weather: {
		schema: weatherSchema,
		Settings: WeatherSettings,
		Style: WeatherStyle,
	},
};

/** The widget types that have a form. */
export const FORM_TYPES: readonly string[] = Object.keys(FORMS);

/**
 * Looks up the form for a widget type.
 * @param type - The widget's `type`, or `null` when it has none.
 * @returns The form, or `null` when there is no form for this type yet.
 */
export function formFor(type: string | null): WidgetFormDefinition | null {
	// `Object.hasOwn` so a type like "constructor" can't hit Object.prototype.
	return type !== null && Object.hasOwn(FORMS, type)
		? (FORMS[type] ?? null)
		: null;
}

/**
 * The schema used to validate a widget type's fields.
 * @param type - The widget's `type`.
 * @returns The type's own schema, or the shared one for types without a form.
 */
export function schemaFor(type: string | null): z.ZodType {
	return formFor(type)?.schema ?? baseWidgetSchema;
}
