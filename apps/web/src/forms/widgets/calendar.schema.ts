import { baseWidgetSchema, oneOf, optional } from "../schema.ts";

// Fields from Glance v0.8.7 widget-calendar.go: first-day-of-week (default monday).

/** Weekday names Glance accepts (`calendarWeekdaysToInt`). */
export const WEEKDAYS = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
] as const;

/** Options of the calendar widget. */
export const calendarSchema = baseWidgetSchema.extend({
	"first-day-of-week": optional(oneOf(WEEKDAYS)),
});
