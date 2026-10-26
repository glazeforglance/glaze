import { z } from "zod";
import {
	baseWidgetSchema,
	list,
	oneOf,
	optional,
	required,
} from "../schema.ts";

// Fields from Glance v0.8.7 widget-clock.go: hour-format, timezones[].timezone/label.

/** Options of the clock widget. */
export const clockSchema = baseWidgetSchema.extend({
	"hour-format": optional(oneOf(["12h", "24h"])),
	timezones: list(
		z.looseObject({
			timezone: required("Enter a timezone, e.g. Europe/Amsterdam"),
			label: optional(z.string()),
		}),
	),
});
