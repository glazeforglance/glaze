import { baseWidgetSchema } from "../schema.ts";

// Glance v0.8.7 widget-group.go: a group has only widgetBase plus its child
// `widgets`. It forces hide-header on itself and on every child, so only
// css-class has an effect.

/** Options of the group widget. */
export const groupSchema = baseWidgetSchema;
