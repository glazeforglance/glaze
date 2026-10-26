import { z } from "zod";
import {
	baseWidgetSchema,
	flag,
	list,
	optional,
	orEnv,
	required,
} from "../schema.ts";

// Fields from Glance v0.8.7 widget-search.go: search-engine (default
// duckduckgo), bangs[] (title, shortcut, url; no yaml tags, so lower-case
// names), new-tab, target, autofocus, placeholder.

/** Engine names Glance knows (`searchEngines`); anything else is used as a URL. */
export const SEARCH_ENGINES = [
	"duckduckgo",
	"google",
	"bing",
	"perplexity",
	"kagi",
	"startpage",
] as const;

const QUERY_HINT = "Pick an engine, or enter a URL with {QUERY} in it";

/** Options of the search widget. */
export const searchSchema = baseWidgetSchema.extend({
	"search-engine": optional(
		orEnv(
			z
				.string()
				.refine(
					(value) =>
						SEARCH_ENGINES.some((engine) => engine === value) ||
						value.includes("{QUERY}"),
					QUERY_HINT,
				),
		),
	),
	bangs: list(
		z.looseObject({
			title: optional(z.string()),
			shortcut: required("A bang needs a shortcut, e.g. !yt"),
			url: required("A bang needs a URL with {QUERY} in it"),
		}),
	),
	"new-tab": flag,
	target: optional(z.string()),
	autofocus: flag,
	placeholder: optional(z.string()),
});
