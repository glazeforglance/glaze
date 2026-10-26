import { z } from "zod";
import {
	baseWidgetSchema,
	duration,
	flag,
	list,
	optional,
	orEnv,
	webUrl,
} from "../schema.ts";

// Fields from Glance v0.8.7 widget-monitor.go: style ("compact" or default),
// show-failing-only, sites[] with the inline SiteStatusRequest (url,
// check-url, allow-insecure, timeout, basic-auth) plus error-url, title,
// icon, same-tab and alt-status-codes.

const statusCode = z
	.number({ error: "Use status codes like 401, 403" })
	.int("Use status codes like 401, 403")
	.min(100, "Status codes go from 100 to 599")
	.max(599, "Status codes go from 100 to 599");

/** One monitored site. */
export const monitorSiteSchema = z.looseObject({
	title: optional(z.string()),
	url: webUrl("A site needs a URL that starts with http:// or https://"),
	"check-url": optional(webUrl()),
	"error-url": optional(webUrl()),
	icon: optional(z.string()),
	"allow-insecure": flag,
	"same-tab": flag,
	timeout: optional(orEnv(duration)),
	"alt-status-codes": optional(list(statusCode)),
	"basic-auth": z
		.looseObject({
			username: optional(z.string()),
			password: optional(z.string()),
		})
		.nullable()
		.optional(),
});

/** Options of the monitor widget. */
export const monitorSchema = baseWidgetSchema.extend({
	style: optional(z.string()),
	"show-failing-only": flag,
	sites: list(monitorSiteSchema),
});
