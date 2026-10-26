import { z } from "zod";
import {
	baseWidgetSchema,
	flag,
	list,
	optional,
	wholeNumber,
} from "../schema.ts";

// Fields from Glance v0.8.7 widget-releases.go: repositories[] (a string like
// `owner/repo` or `gitlab:owner/repo`, or a map with repository and
// include-prereleases), token, gitlab-token, limit (default 10),
// collapse-after (default 5, -1 = never), show-source-icon.

/** Source prefixes Glance knows (`releaseSource`); no prefix means GitHub. */
export const RELEASE_SOURCES = [
	"github",
	"gitlab",
	"dockerhub",
	"codeberg",
] as const;

const MISSING = "Enter a repository, e.g. glanceapp/glance";
const BAD_SOURCE =
	"Start with github:, gitlab:, dockerhub: or codeberg:, or leave the prefix out";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One repository: a string or a `{ repository, include-prereleases }` map. */
export const releaseRepositorySchema = z.unknown().superRefine((item, ctx) => {
	const inMap = isRecord(item);
	const repository = inMap ? item.repository : item;
	const path = inMap ? ["repository"] : [];
	if (typeof repository !== "string" || repository.trim() === "") {
		ctx.addIssue({ code: "custom", message: MISSING, path });
		return;
	}
	const colon = repository.indexOf(":");
	const source = colon === -1 ? null : repository.slice(0, colon);
	if (source !== null && !RELEASE_SOURCES.some((known) => known === source)) {
		ctx.addIssue({ code: "custom", message: BAD_SOURCE, path });
	}
	const prereleases = inMap ? item["include-prereleases"] : undefined;
	if (prereleases !== undefined && typeof prereleases !== "boolean") {
		ctx.addIssue({
			code: "custom",
			message: "Use true or false",
			path: ["include-prereleases"],
		});
	}
});

/** Options of the releases widget. */
export const releasesSchema = baseWidgetSchema.extend({
	repositories: list(releaseRepositorySchema),
	token: optional(z.string()),
	"gitlab-token": optional(z.string()),
	limit: optional(wholeNumber(1)),
	"collapse-after": optional(wholeNumber(-1)),
	"show-source-icon": flag,
});
