import { z } from "zod";
import { baseWidgetSchema, flag, optional, webUrl } from "../schema.ts";

// Fields from Glance v0.8.7 widget-docker-containers.go: hide-by-default,
// running-only, category, sock-path (default /var/run/docker.sock),
// format-container-names, and `containers` (yaml tag of LabelOverrides): a
// map from container name to label values without the `glance.` prefix
// (name, url, description, icon, same-tab, hide, id, parent, category).

/** Label values for one container. Glance reads them as strings. */
export const containerLabelsSchema = z.looseObject({
	name: optional(z.string()),
	url: optional(webUrl()),
	description: optional(z.string()),
	icon: optional(z.string()),
	"same-tab": z.union([z.boolean(), z.string()]).optional(),
	hide: z.union([z.boolean(), z.string()]).optional(),
	id: optional(z.string()),
	parent: optional(z.string()),
	category: optional(z.string()),
});

/** Options of the docker-containers widget. */
export const dockerContainersSchema = baseWidgetSchema.extend({
	"hide-by-default": flag,
	"running-only": flag,
	category: optional(z.string()),
	"sock-path": optional(z.string()),
	"format-container-names": flag,
	containers: z
		.record(z.string(), containerLabelsSchema.nullable())
		.nullable()
		.optional(),
});
