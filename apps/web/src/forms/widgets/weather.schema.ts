import {
	baseWidgetSchema,
	flag,
	oneOf,
	optional,
	required,
} from "../schema.ts";

// Fields from Glance v0.8.7 widget-weather.go: location (required), units
// (default metric), hour-format (default 12h), show-area-name, hide-location.

/** Options of the weather widget. */
export const weatherSchema = baseWidgetSchema.extend({
	location: required("Enter a location, e.g. Amsterdam, Netherlands"),
	units: optional(oneOf(["metric", "imperial"])),
	"hour-format": optional(oneOf(["12h", "24h"])),
	"show-area-name": flag,
	"hide-location": flag,
});
