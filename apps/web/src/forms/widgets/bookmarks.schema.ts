import { z } from "zod";
import {
	baseWidgetSchema,
	flag,
	hslColor,
	list,
	optional,
	orEnv,
	webUrl,
} from "../schema.ts";

// Fields from Glance v0.8.7 widget-bookmarks.go: groups[] (title, color,
// same-tab, hide-arrow, target, links[]) and links[] (title, url,
// description, icon, same-tab, hide-arrow, target). A link's same-tab and
// hide-arrow fall back to its group's when they aren't set.

/** One bookmark. */
export const bookmarkLinkSchema = z.looseObject({
	title: optional(z.string()),
	url: webUrl("A link needs a URL that starts with http:// or https://"),
	description: optional(z.string()),
	icon: optional(z.string()),
	"same-tab": flag,
	"hide-arrow": flag,
	target: optional(z.string()),
});

/** One group of bookmarks. */
export const bookmarkGroupSchema = z.looseObject({
	title: optional(z.string()),
	color: optional(orEnv(hslColor)),
	"same-tab": flag,
	"hide-arrow": flag,
	target: optional(z.string()),
	links: list(bookmarkLinkSchema),
});

/** Options of the bookmarks widget. */
export const bookmarksSchema = baseWidgetSchema.extend({
	groups: list(bookmarkGroupSchema),
});
