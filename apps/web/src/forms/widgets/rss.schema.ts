import { z } from "zod";
import {
	baseWidgetSchema,
	flag,
	list,
	oneOf,
	optional,
	orEnv,
	webUrl,
	wholeNumber,
} from "../schema.ts";

// Fields from Glance v0.8.7 widget-rss.go: feeds[] (url, title,
// hide-categories, hide-description, limit, item-link-prefix,
// thumbnail-link-prefix, headers), style, thumbnail-height, card-height,
// limit (default 25), collapse-after (default 5, -1 = never),
// single-line-titles, preserve-order.

/** Layouts Glance renders (default vertical-list). */
export const RSS_STYLES = [
	"vertical-list",
	"detailed-list",
	"horizontal-cards",
	"horizontal-cards-2",
] as const;

const height = orEnv(
	z.number({ error: "Enter a number" }).min(0, "Use 0 or more"),
);

/** One feed. */
export const rssFeedSchema = z.looseObject({
	url: webUrl("A feed needs a URL that starts with http:// or https://"),
	title: optional(z.string()),
	"hide-categories": flag,
	"hide-description": flag,
	limit: optional(wholeNumber(1)),
	"item-link-prefix": optional(z.string()),
	"thumbnail-link-prefix": optional(z.string()),
	headers: z.record(z.string(), z.unknown()).nullable().optional(),
});

/** Options of the rss widget. */
export const rssSchema = baseWidgetSchema.extend({
	feeds: list(rssFeedSchema),
	style: optional(oneOf(RSS_STYLES)),
	"thumbnail-height": optional(height),
	"card-height": optional(height),
	limit: optional(wholeNumber(1)),
	"collapse-after": optional(wholeNumber(-1)),
	"single-line-titles": flag,
	"preserve-order": flag,
});
