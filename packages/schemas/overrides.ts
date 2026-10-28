/*
 * Hand-written additions to the schemas generated from the Glance source:
 * labels, help texts, enums the code doesn't spell out, defaults from the
 * docs, field order and grouping, and the options a new widget starts with.
 *
 * The generator (pnpm schemas) merges this file in and fails when an entry
 * names a field Glance doesn't have, or when an enum leaves out a value the
 * Glance code accepts. Only erasable TypeScript here (plain Node runs it).
 *
 * Where the Glance code and its docs disagree, the code wins; the help text
 * says so.
 */
import type {
	FieldOverride,
	Overrides,
	WidgetOverride,
} from "./src/override-types.ts";
import type { FieldGroup } from "./src/types.ts";

const DISPLAY: FieldGroup = { id: "display", label: "Display", tab: "style" };

const COLLAPSE_AFTER: FieldOverride = {
	label: "Show before “Show more”",
	help: "How many items are visible before the rest is folded away. -1 shows everything.",
	min: -1,
	group: "display",
};

const LIMIT: FieldOverride = {
	label: "Number of items",
	min: 1,
};

const SECRET_HELP = "Prefer ${YOUR_VAR} so the value stays out of glance.yml.";

const HOUR_FORMAT: FieldOverride = {
	label: "Clock",
	options: [
		{ value: "12h", label: "12-hour" },
		{ value: "24h", label: "24-hour" },
	],
};

const BASIC_AUTH: FieldOverride = {
	label: "Basic authentication",
	advanced: true,
	fields: {
		username: { label: "Username" },
		password: { label: "Password", help: SECRET_HELP },
	},
};

const HEADERS: FieldOverride = {
	label: "Headers",
	keyLabel: "Header",
	advanced: true,
	help: "Sent with every request, e.g. Authorization or X-Api-Key.",
};

const PARAMETERS: FieldOverride = {
	label: "Query parameters",
	keyLabel: "Parameter",
	advanced: true,
	help: "Added to the URL. A parameter with several values is repeated.",
};

const ICON_HELP =
	"si:name (Simple Icons), di:name (Dashboard Icons), sh:name (selfh.st), mdi:name, or an image URL. Start with “auto-invert ” to invert it on light themes.";

/** The request fields shared by custom-api and each of its subrequests. */
const REQUEST_FIELDS: Readonly<Record<string, FieldOverride>> = {
	url: {
		label: "URL",
		placeholder: "https://api.example.com/v1/status",
		help: "The address to fetch. Without it, the template still renders, with no data.",
	},
	method: {
		kind: "enum",
		label: "Method",
		options: [
			{ value: "GET" },
			{ value: "POST" },
			{ value: "PUT" },
			{ value: "PATCH" },
			{ value: "DELETE" },
		],
		allowCustom: true,
		help: "GET by default; POST when a body is set.",
	},
	headers: HEADERS,
	parameters: PARAMETERS,
	"body-type": {
		label: "Body type",
		options: [
			{ value: "json", label: "JSON", help: "The body is sent as JSON." },
			{ value: "string", label: "Text", help: "The body must be a string." },
		],
		advanced: true,
	},
	body: {
		label: "Body",
		help: "Sent with the request; any YAML value (sent as JSON unless the body type is text).",
		advanced: true,
	},
	"basic-auth": BASIC_AUTH,
	"allow-insecure": {
		label: "Allow invalid certificates",
		advanced: true,
	},
	"skip-json-validation": {
		label: "Don't check that the response is JSON",
		advanced: true,
	},
};

const WIDGETS: Readonly<Record<string, WidgetOverride>> = {
	calendar: {
		label: "Calendar",
		description: "A month calendar.",
		fields: {
			"first-day-of-week": {
				label: "Week starts on",
				options: [
					{ value: "monday", label: "Monday" },
					{ value: "tuesday", label: "Tuesday" },
					{ value: "wednesday", label: "Wednesday" },
					{ value: "thursday", label: "Thursday" },
					{ value: "friday", label: "Friday" },
					{ value: "saturday", label: "Saturday" },
					{ value: "sunday", label: "Sunday" },
				],
			},
		},
	},
	"calendar-legacy": {
		label: "Calendar (legacy)",
		description: "The old calendar widget; use Calendar for new pages.",
		fields: {
			calendar: {
				hidden: "Glance keeps its own state here; it isn't an option.",
			},
			"start-sunday": { label: "Week starts on Sunday" },
		},
	},
	clock: {
		label: "Clock",
		description: "The time here and in other time zones.",
		fields: {
			"hour-format": HOUR_FORMAT,
			timezones: {
				label: "Other time zones",
				fields: {
					timezone: {
						label: "Time zone",
						placeholder: "Europe/Amsterdam",
						help: "A name from the tz database.",
					},
					label: { label: "Label", placeholder: "Home" },
				},
			},
		},
	},
	weather: {
		label: "Weather",
		description: "Current weather and the next hours, from Open-Meteo.",
		groups: [DISPLAY],
		fields: {
			location: {
				label: "Location",
				placeholder: "Amsterdam, Netherlands",
				help: "A place name; add the country when the name isn't unique.",
			},
			units: {
				label: "Units",
				options: [
					{ value: "metric", label: "Metric (°C)" },
					{ value: "imperial", label: "Imperial (°F)" },
				],
			},
			"hour-format": {
				...HOUR_FORMAT,
				kind: "enum",
				default: "12h",
				group: "display",
			},
			"show-area-name": { label: "Show the area name", group: "display" },
			"hide-location": { label: "Hide the location", group: "display" },
		},
		newWidget: { location: "London, United Kingdom" },
	},
	bookmarks: {
		label: "Bookmarks",
		description: "Groups of links.",
		fields: {
			groups: {
				label: "Groups",
				fields: {
					title: { label: "Group name" },
					color: {
						label: "Color",
						help: "Uses the theme's primary color when empty.",
					},
					links: {
						label: "Links",
						fields: {
							title: { label: "Title", required: true },
							url: { label: "URL", required: true },
							description: { label: "Description" },
							icon: { label: "Icon", help: ICON_HELP },
							"same-tab": { label: "Open in the same tab" },
							"hide-arrow": { label: "Hide the arrow" },
							target: {
								label: "Link target",
								placeholder: "_blank",
								advanced: true,
							},
						},
					},
					"same-tab": { label: "Open links in the same tab" },
					"hide-arrow": { label: "Hide the arrows" },
					target: {
						label: "Link target",
						placeholder: "_blank",
						advanced: true,
					},
				},
			},
		},
		newWidget: {
			groups: [
				{
					title: "Links",
					links: [
						{ title: "Glance", url: "https://github.com/glanceapp/glance" },
					],
				},
			],
		},
	},
	iframe: {
		label: "Iframe",
		description: "Another web page inside a widget.",
		fields: {
			source: {
				kind: "url",
				label: "Page URL",
				placeholder: "https://example.com",
				warning:
					"The page must allow being shown in a frame (no X-Frame-Options).",
			},
			height: {
				label: "Height (px)",
				default: 50,
				min: 50,
				help: "In Glance v0.8.7 a missing height gives 50 px (the docs say 300), so set it.",
			},
		},
		newWidget: { source: "https://example.com", height: 300 },
	},
	html: {
		label: "HTML",
		description: "Your own HTML, shown as is.",
		fields: {
			source: {
				label: "HTML",
				warning:
					"This HTML is not sanitized: scripts in it run on your dashboard.",
			},
		},
		newWidget: { source: "<p>Hello from Glaze.</p>" },
	},
	"hacker-news": {
		label: "Hacker News",
		description: "Top stories from Hacker News.",
		groups: [DISPLAY],
		fields: {
			limit: LIMIT,
			"sort-by": {
				label: "Stories",
				options: [
					{ value: "top", label: "Top" },
					{ value: "new", label: "New" },
					{ value: "best", label: "Best" },
				],
			},
			"extra-sort-by": {
				kind: "enum",
				label: "Then sort by",
				options: [{ value: "engagement", label: "Engagement" }],
				help: "Re-sorts the stories by comments and points.",
			},
			"collapse-after": COLLAPSE_AFTER,
			"comments-url-template": {
				label: "Comments link",
				placeholder: "https://news.ycombinator.com/item?id={POST-ID}",
				help: "Where a post's comments open; {POST-ID} is replaced.",
				advanced: true,
			},
		},
	},
	releases: {
		label: "Releases",
		description:
			"Latest releases of GitHub, GitLab, Codeberg and Docker Hub projects.",
		groups: [DISPLAY],
		fields: {
			repositories: {
				label: "Repositories",
				item: {
					variants: [
						{
							label: "Repository",
							placeholder: "glanceapp/glance",
							help: "owner/repo for GitHub; start with gitlab:, dockerhub: or codeberg: for other sources.",
						},
						{
							fields: {
								repository: {
									label: "Repository",
									placeholder: "glanceapp/glance",
									required: true,
								},
								"include-prereleases": { label: "Include pre-releases" },
							},
						},
					],
				},
			},
			token: {
				label: "GitHub token",
				help: `Raises GitHub's rate limit. ${SECRET_HELP}`,
			},
			"gitlab-token": { label: "GitLab token", help: SECRET_HELP },
			limit: LIMIT,
			"collapse-after": COLLAPSE_AFTER,
			"show-source-icon": { label: "Show the source's icon", group: "display" },
		},
		newWidget: { repositories: ["glanceapp/glance"] },
	},
	videos: {
		label: "Videos",
		description: "Latest videos from YouTube channels and playlists.",
		groups: [DISPLAY],
		fields: {
			channels: {
				label: "Channels",
				item: { placeholder: "UCXuqSBlHAE6Xw-yeJA0Tunw", label: "Channel ID" },
				help: "YouTube channel IDs (they start with UC).",
			},
			playlists: {
				label: "Playlists",
				item: { label: "Playlist ID" },
			},
			limit: LIMIT,
			style: {
				kind: "enum",
				label: "Layout",
				default: "horizontal-cards",
				options: [
					{ value: "horizontal-cards", label: "Cards in a row" },
					{ value: "grid-cards", label: "Grid of cards" },
					{ value: "vertical-list", label: "List" },
				],
				group: "display",
			},
			"collapse-after": COLLAPSE_AFTER,
			"collapse-after-rows": {
				label: "Rows before “Show more”",
				help: "For the grid layout. -1 shows everything.",
				min: -1,
				group: "display",
			},
			"include-shorts": { label: "Include Shorts" },
			"video-url-template": {
				label: "Video link",
				placeholder: "https://www.youtube.com/watch?v={VIDEO-ID}",
				help: "Where a video opens; {VIDEO-ID} is replaced.",
				advanced: true,
			},
		},
	},
	markets: {
		label: "Markets",
		description: "Stock and crypto prices from Yahoo Finance.",
		order: [
			"markets",
			"sort-by",
			"chart-link-template",
			"symbol-link-template",
			"stocks",
		],
		fields: {
			markets: {
				label: "Markets",
				fields: {
					symbol: { label: "Symbol", placeholder: "SPY", required: true },
					name: { label: "Name", placeholder: "S&P 500" },
					"chart-link": { label: "Chart link", kind: "url", advanced: true },
					"symbol-link": { label: "Symbol link", kind: "url", advanced: true },
				},
			},
			stocks: {
				label: "Stocks (old name)",
				help: "The old name of the markets list, used when “Markets” is empty. Prefer Markets.",
				advanced: true,
				fields: {
					symbol: { label: "Symbol", required: true },
					name: { label: "Name" },
					"chart-link": { label: "Chart link", kind: "url" },
					"symbol-link": { label: "Symbol link", kind: "url" },
				},
			},
			"sort-by": {
				kind: "enum",
				label: "Sort by",
				options: [
					{ value: "change", label: "Change (%)" },
					{ value: "absolute-change", label: "Change (absolute)" },
				],
				help: "Leave empty to keep your order.",
			},
			"chart-link-template": {
				label: "Chart link",
				placeholder: "https://www.tradingview.com/chart/?symbol={SYMBOL}",
				help: "Used for every market without its own; {SYMBOL} is replaced.",
				advanced: true,
			},
			"symbol-link-template": {
				label: "Symbol link",
				placeholder: "https://www.google.com/search?q={SYMBOL}",
				help: "Used for every market without its own; {SYMBOL} is replaced.",
				advanced: true,
			},
		},
		newWidget: { markets: [{ symbol: "SPY", name: "S&P 500" }] },
	},
	reddit: {
		label: "Reddit",
		description: "Posts from a subreddit.",
		groups: [DISPLAY],
		order: ["subreddit", "sort-by", "top-period", "search", "limit", "style"],
		fields: {
			subreddit: {
				label: "Subreddit",
				placeholder: "selfhosted",
				help: "Without r/.",
			},
			style: {
				kind: "enum",
				label: "Layout",
				default: "vertical-list",
				options: [
					{ value: "vertical-list", label: "List" },
					{ value: "horizontal-cards", label: "Cards in a row" },
					{ value: "vertical-cards", label: "Cards below each other" },
				],
				group: "display",
			},
			"show-thumbnails": { label: "Show thumbnails", group: "display" },
			"show-flairs": { label: "Show flairs", group: "display" },
			"sort-by": {
				label: "Sort by",
				options: [
					{ value: "hot", label: "Hot" },
					{ value: "new", label: "New" },
					{ value: "top", label: "Top" },
					{ value: "rising", label: "Rising" },
				],
			},
			"top-period": {
				label: "Top of the",
				help: "Only for “Top”.",
				options: [
					{ value: "hour", label: "Hour" },
					{ value: "day", label: "Day" },
					{ value: "week", label: "Week" },
					{ value: "month", label: "Month" },
					{ value: "year", label: "Year" },
					{ value: "all", label: "All time" },
				],
			},
			search: {
				label: "Search",
				help: "Only works with app authentication (Reddit's API rules).",
			},
			"extra-sort-by": {
				kind: "enum",
				label: "Then sort by",
				options: [{ value: "engagement", label: "Engagement" }],
			},
			"comments-url-template": {
				label: "Comments link",
				placeholder: "https://www.reddit.com/{POST-PATH}",
				help: "{POST-PATH}, {POST-ID} and {SUBREDDIT} are replaced.",
				advanced: true,
			},
			limit: LIMIT,
			"collapse-after": COLLAPSE_AFTER,
			"request-url-template": {
				label: "Request through",
				placeholder: "https://proxy.example.com/?url={REQUEST-URL}",
				help: "Fetches Reddit through another address; must contain {REQUEST-URL}.",
				advanced: true,
			},
			proxy: {
				label: "Proxy",
				advanced: true,
				variants: [
					{ placeholder: "http://user:pass@proxy:8080" },
					{
						fields: {
							url: { label: "Proxy URL" },
							"allow-insecure": { label: "Allow invalid certificates" },
							timeout: { label: "Timeout" },
						},
					},
				],
			},
			"app-auth": {
				label: "App authentication",
				help: "A Reddit app (name, client ID and secret); all three or none.",
				advanced: true,
				fields: {
					name: { label: "App name" },
					id: { label: "Client ID" },
					secret: { label: "Client secret", help: SECRET_HELP },
				},
			},
		},
		newWidget: { subreddit: "selfhosted" },
	},
	rss: {
		label: "RSS",
		description: "Items from one or more RSS or Atom feeds.",
		groups: [DISPLAY],
		fields: {
			feeds: {
				label: "Feeds",
				fields: {
					url: { label: "Feed URL", required: true },
					title: {
						label: "Title",
						help: "Uses the feed's own title when empty.",
					},
					limit: { label: "Items from this feed", min: 1 },
					"hide-categories": {
						label: "Hide categories",
						help: "Detailed list only.",
					},
					"hide-description": {
						label: "Hide the description",
						help: "Detailed list only.",
					},
					"item-link-prefix": { label: "Item link prefix", advanced: true },
					"thumbnail-link-prefix": {
						label: "Thumbnail link prefix",
						advanced: true,
					},
					headers: HEADERS,
				},
			},
			style: {
				kind: "enum",
				label: "Layout",
				default: "vertical-list",
				options: [
					{ value: "vertical-list", label: "List" },
					{ value: "detailed-list", label: "Detailed list" },
					{ value: "horizontal-cards", label: "Cards in a row" },
					{ value: "horizontal-cards-2", label: "Cards in a row (big)" },
				],
				group: "display",
			},
			"thumbnail-height": {
				label: "Thumbnail height (rem)",
				default: 10,
				min: 0,
				group: "display",
				help: "Cards layouts only.",
			},
			"card-height": {
				label: "Card height (rem)",
				default: 27,
				min: 0,
				group: "display",
				help: "Cards layouts only.",
			},
			limit: LIMIT,
			"collapse-after": COLLAPSE_AFTER,
			"single-line-titles": { label: "Titles on one line", group: "display" },
			"preserve-order": {
				label: "Keep the feeds' order",
				help: "Instead of sorting by date.",
			},
		},
		newWidget: { feeds: [{ url: "https://selfh.st/rss/" }] },
	},
	monitor: {
		label: "Monitor",
		description: "Whether your sites and services are up.",
		groups: [DISPLAY],
		order: ["sites", "show-failing-only", "style"],
		fields: {
			sites: {
				label: "Sites",
				fields: {
					title: { label: "Title", required: true },
					url: {
						label: "URL",
						required: true,
						help: "Opens when the site is clicked; also checked, unless a check URL is set.",
					},
					"check-url": {
						label: "Check URL",
						help: "Checked instead of the URL, e.g. an internal address.",
					},
					"error-url": {
						label: "Error URL",
						help: "Opens instead of the URL while the site is down.",
						advanced: true,
					},
					icon: { label: "Icon", help: ICON_HELP },
					timeout: { label: "Timeout", default: "3s" },
					"alt-status-codes": {
						label: "Also OK",
						help: "Status codes that count as up, besides 200.",
						advanced: true,
					},
					"allow-insecure": {
						label: "Allow invalid certificates",
						advanced: true,
					},
					"same-tab": { label: "Open in the same tab" },
					"basic-auth": BASIC_AUTH,
				},
			},
			style: {
				kind: "enum",
				label: "Layout",
				options: [{ value: "compact", label: "Compact" }],
				help: "Leave empty for the default layout.",
				group: "display",
			},
			"show-failing-only": { label: "Only show failing sites" },
		},
		newWidget: {
			sites: [{ title: "Glance", url: "https://github.com/glanceapp/glance" }],
		},
	},
	"twitch-top-games": {
		label: "Twitch top games",
		description: "The most watched games on Twitch.",
		groups: [DISPLAY],
		fields: {
			exclude: {
				label: "Leave out",
				item: { label: "Game slug", placeholder: "just-chatting" },
			},
			limit: LIMIT,
			"collapse-after": COLLAPSE_AFTER,
		},
	},
	"twitch-channels": {
		label: "Twitch channels",
		description: "Which Twitch channels are live.",
		groups: [DISPLAY],
		fields: {
			channels: {
				label: "Channels",
				item: { label: "Channel name", placeholder: "theprimeagen" },
			},
			"collapse-after": COLLAPSE_AFTER,
			"sort-by": {
				label: "Sort by",
				options: [
					{ value: "viewers", label: "Viewers" },
					{ value: "live", label: "Live first" },
				],
			},
		},
	},
	lobsters: {
		label: "Lobsters",
		description: "Stories from lobste.rs or another Lobsters site.",
		groups: [DISPLAY],
		fields: {
			"instance-url": {
				label: "Site",
				placeholder: "https://lobste.rs/",
				default: "https://lobste.rs/",
			},
			"custom-url": {
				label: "Custom feed URL",
				help: "A JSON feed URL; overrides the site, sort and tags.",
				advanced: true,
			},
			limit: LIMIT,
			"collapse-after": COLLAPSE_AFTER,
			"sort-by": {
				label: "Sort by",
				options: [
					{ value: "hot", label: "Hot" },
					{ value: "new", label: "New" },
				],
			},
			tags: {
				label: "Only these tags",
				item: { label: "Tag", placeholder: "linux" },
			},
		},
	},
	"change-detection": {
		label: "Change detection",
		description: "Recent changes found by changedetection.io.",
		groups: [DISPLAY],
		fields: {
			"instance-url": { label: "Instance URL" },
			token: { label: "API key", help: SECRET_HELP },
			watches: {
				label: "Only these watches",
				item: { label: "Watch UUID" },
				help: "Leave empty to show all watches.",
			},
			limit: LIMIT,
			"collapse-after": COLLAPSE_AFTER,
		},
	},
	repository: {
		label: "Repository",
		description: "Pull requests, issues and commits of a GitHub repository.",
		fields: {
			repository: {
				label: "Repository",
				placeholder: "glanceapp/glance",
				required: true,
				help: "owner/repo on GitHub.",
			},
			token: { label: "GitHub token", help: SECRET_HELP },
			"pull-requests-limit": {
				label: "Pull requests",
				help: "How many to show; -1 hides them.",
				min: -1,
			},
			"issues-limit": {
				label: "Issues",
				help: "How many to show; -1 hides them.",
				min: -1,
			},
			"commits-limit": {
				label: "Commits",
				help: "How many to show; -1 hides them.",
				min: -1,
			},
		},
		newWidget: { repository: "glanceapp/glance" },
	},
	search: {
		label: "Search",
		description: "A search bar, with bangs as shortcuts.",
		fields: {
			"search-engine": {
				label: "Search engine",
				help: "A name from the list, or your own URL with {QUERY} where the search goes.",
				options: [
					{ value: "duckduckgo", label: "DuckDuckGo" },
					{ value: "google", label: "Google" },
					{ value: "bing", label: "Bing" },
					{ value: "perplexity", label: "Perplexity" },
					{ value: "kagi", label: "Kagi" },
					{ value: "startpage", label: "Startpage" },
				],
			},
			placeholder: { label: "Placeholder" },
			"new-tab": { label: "Open results in a new tab" },
			autofocus: { label: "Focus the search bar on load" },
			target: {
				label: "Link target",
				placeholder: "_blank",
				default: "_blank",
				advanced: true,
			},
			bangs: {
				label: "Bangs",
				help: "Type the shortcut before your search to use another site.",
				fields: {
					title: { label: "Title" },
					shortcut: { label: "Shortcut", placeholder: "!yt" },
					url: {
						kind: "text",
						label: "URL",
						placeholder: "https://www.youtube.com/results?search_query={QUERY}",
						help: "{QUERY} is replaced by your search.",
					},
				},
			},
		},
	},
	extension: {
		label: "Extension",
		description: "HTML from your own service, shown as a widget.",
		fields: {
			url: {
				label: "URL",
				help: "Your service's address; it answers with the widget's HTML.",
			},
			"fallback-content-type": {
				kind: "enum",
				label: "Content type",
				options: [{ value: "html", label: "HTML" }],
				help: "Used when the response doesn't send a Widget-Content-Type header.",
			},
			parameters: PARAMETERS,
			headers: HEADERS,
			"allow-potentially-dangerous-html": {
				label: "Allow unsafe HTML",
				warning:
					"The extension's HTML is shown without sanitizing: only turn this on for a service you trust.",
			},
		},
	},
	group: {
		label: "Group (tabs)",
		description: "Several widgets as tabs.",
		fields: {
			widgets: {
				label: "Tabs",
				help: "Drag widgets into the group on the canvas.",
			},
		},
	},
	"dns-stats": {
		label: "DNS stats",
		description: "Statistics from AdGuard Home, Pi-hole or Technitium.",
		groups: [DISPLAY],
		order: ["service", "url", "token", "username", "password"],
		fields: {
			service: {
				label: "Service",
				required: true,
				help: "Glance v0.8.7 refuses an empty service (the docs say pihole is the default).",
				options: [
					{ value: "adguard", label: "AdGuard Home" },
					{ value: "pihole-v6", label: "Pi-hole 6+" },
					{ value: "pihole", label: "Pi-hole 5 and older" },
					{ value: "technitium", label: "Technitium" },
				],
			},
			url: { label: "URL", placeholder: "http://pihole.local" },
			token: {
				label: "API token",
				help: `Pi-hole 5 and Technitium. ${SECRET_HELP}`,
			},
			username: { label: "Username", help: "AdGuard Home only." },
			password: {
				label: "Password",
				help: `AdGuard Home and Pi-hole 6. ${SECRET_HELP}`,
			},
			"allow-insecure": { label: "Allow invalid certificates", advanced: true },
			"hide-graph": { label: "Hide the graph", group: "display" },
			"hide-top-domains": {
				label: "Hide top blocked domains",
				group: "display",
			},
			"hour-format": {
				...HOUR_FORMAT,
				kind: "enum",
				default: "12h",
				group: "display",
			},
		},
		newWidget: { service: "pihole-v6", url: "http://pihole.local" },
	},
	"split-column": {
		label: "Split column",
		description: "Widgets side by side in equal columns.",
		fields: {
			widgets: {
				label: "Widgets",
				help: "Drop widgets beside each other on the canvas.",
			},
			"max-columns": {
				label: "Columns",
				min: 2,
				help: "Glance uses at least 2; every widget gets the same width.",
			},
		},
	},
	"custom-api": {
		label: "Custom API",
		description: "Data from any JSON API, shown with your own template.",
		groups: [
			{ id: "request", label: "Request" },
			{ id: "template", label: "Template" },
		],
		order: [
			"url",
			"method",
			"headers",
			"parameters",
			"body-type",
			"body",
			"basic-auth",
			"allow-insecure",
			"skip-json-validation",
			"subrequests",
			"options",
			"template",
			"frameless",
		],
		fields: {
			...Object.fromEntries(
				Object.entries(REQUEST_FIELDS).map(([key, field]) => [
					key,
					{ ...field, group: "request" },
				]),
			),
			subrequests: {
				label: "Subrequests",
				keyLabel: "Name",
				group: "request",
				advanced: true,
				help: 'More requests; use them in the template with .Subrequest "name".',
				fields: REQUEST_FIELDS,
			},
			options: {
				label: "Options",
				keyLabel: "Option",
				group: "template",
				advanced: true,
				help: 'Values for the template, read with .Options.StringOr "name" "default".',
			},
			template: {
				kind: "code",
				language: "go-template",
				label: "Template",
				group: "template",
				help: "HTML with Go template actions; the response is .JSON.",
			},
			frameless: { label: "No frame around the widget", group: "template" },
		},
		newWidget: {
			url: "https://api.github.com/repos/glanceapp/glance",
			template:
				'<p class="size-h3 color-highlight">{{ .JSON.Int "stargazers_count" }} stars</p>\n',
		},
	},
	"docker-containers": {
		label: "Docker containers",
		description: "Your containers and whether they run.",
		groups: [DISPLAY],
		fields: {
			"sock-path": {
				label: "Docker socket",
				placeholder: "/var/run/docker.sock",
				help: "A path, or tcp://host:2375 for a remote Docker API.",
			},
			category: {
				label: "Category",
				help: "Only containers with this glance.category label.",
			},
			"running-only": { label: "Only running containers" },
			"hide-by-default": {
				label: "Hide unless labelled",
				help: "Only show containers with glance.hide=false.",
			},
			"format-container-names": {
				label: "Tidy up container names",
				group: "display",
			},
			containers: {
				label: "Container labels",
				keyLabel: "Container name",
				help: "Glance labels (name, url, icon, description, …) per container, without touching Docker.",
				item: {
					label: "Labels",
					keyLabel: "Label",
				},
			},
		},
	},
	"server-stats": {
		label: "Server stats",
		description: "CPU, memory and disk use of this or other servers.",
		fields: {
			servers: {
				label: "Servers",
				help: "Leave empty for the server Glance runs on.",
				fields: {
					type: {
						kind: "enum",
						label: "Type",
						required: true,
						options: [
							{ value: "local", label: "This server" },
							{ value: "remote", label: "Remote (Glance agent)" },
						],
					},
					name: { label: "Name" },
					url: { label: "Agent URL", help: "Remote servers only." },
					token: {
						label: "Agent token",
						help: `Remote servers only. ${SECRET_HELP}`,
					},
					timeout: { label: "Timeout", help: "Remote servers only." },
					"hide-swap": { label: "Hide swap" },
					"cpu-temp-sensor": {
						label: "CPU temperature sensor",
						help: "A sensor name from `glance sensors:print`.",
						advanced: true,
					},
					"hide-mountpoints-by-default": {
						label: "Hide disks unless listed",
						advanced: true,
					},
					mountpoints: {
						label: "Disks",
						keyLabel: "Mount point",
						advanced: true,
						fields: {
							name: { label: "Name" },
							hide: { label: "Hide" },
						},
					},
				},
			},
		},
	},
	"to-do": {
		label: "To-do",
		description: "A to-do list stored in your browser.",
		fields: {
			id: {
				label: "List id",
				help: "Lists with the same id share their items.",
				advanced: true,
			},
		},
	},
};

/** The options every widget has (`widgetBase`). */
const BASE: Readonly<Record<string, FieldOverride>> = {
	type: { hidden: "Set by the widget type; change it in the YAML tab." },
	title: { label: "Title" },
	"title-url": {
		label: "Title link",
		help: "Opens when the title is clicked.",
	},
	"hide-header": { label: "Hide the header", group: "style" },
	"css-class": {
		label: "CSS class",
		help: "Added to the widget, for your own custom CSS.",
		group: "style",
	},
	cache: {
		label: "Refresh",
		help: "How long Glance keeps the data before fetching it again.",
	},
};

const PAGE: Readonly<Record<string, FieldOverride>> = {
	name: { label: "Name", required: true },
	slug: { label: "URL path", help: "Made from the name when empty." },
	width: {
		kind: "enum",
		label: "Width",
		options: [
			{ value: "default", label: "Default" },
			{ value: "slim", label: "Slim", help: "At most 2 columns." },
			{ value: "wide", label: "Wide" },
		],
	},
	"desktop-navigation-width": {
		kind: "enum",
		label: "Navigation width",
		help: "The width of the top navigation on desktop; follows the page width when empty.",
		options: [
			{ value: "default", label: "Default" },
			{ value: "slim", label: "Slim" },
			{ value: "wide", label: "Wide" },
		],
	},
	"show-mobile-header": { label: "Show the header on phones" },
	"hide-desktop-navigation": { label: "Hide the navigation on desktop" },
	"center-vertically": { label: "Center the columns vertically" },
	"head-widgets": { label: "Head widgets", help: "Edited on the canvas." },
	columns: {
		label: "Columns",
		hidden: "Edited on the canvas.",
		fields: {
			size: {
				kind: "enum",
				label: "Size",
				required: true,
				options: [
					{ value: "small", label: "Small" },
					{ value: "full", label: "Full" },
				],
			},
			widgets: { label: "Widgets" },
		},
	},
};

const THEME_FIELDS: Readonly<Record<string, FieldOverride>> = {
	"background-color": { label: "Background", placeholder: "240 8 9" },
	"primary-color": { label: "Primary", placeholder: "43 50 70" },
	"positive-color": { label: "Positive", help: "Same as primary when empty." },
	"negative-color": { label: "Negative", placeholder: "0 70 70" },
	light: { label: "Light theme" },
	"contrast-multiplier": { label: "Contrast", default: 1, min: 0 },
	"text-saturation-multiplier": {
		label: "Text saturation",
		default: 1,
		min: 0,
	},
};

const CONFIG: Readonly<Record<string, FieldOverride>> = {
	server: {
		label: "Server",
		fields: {
			host: {
				label: "Listen address",
				help: "Leave empty. Only set this if Glance must listen on one specific network interface.",
			},
			port: {
				label: "Listen port (inside the container)",
				help: "Usually 8080. To reach Glance on another port, change your Docker port mapping.",
				default: 8080,
				min: 1,
				max: 65535,
			},
			proxied: {
				label: "Behind a reverse proxy",
				help: "Read the client's address from X-Forwarded-For (needed for login rate limits behind a proxy).",
			},
			"base-url": {
				kind: "text",
				label: "Base path",
				placeholder: "e.g. /glance",
				help: "Only when a reverse proxy serves Glance under a path, e.g. example.com/glance. Starts with /.",
			},
			"assets-path": {
				label: "Assets folder",
				placeholder: "/app/assets",
				help: "A folder Glance serves at /assets/ (as Glance sees it).",
			},
		},
	},
	auth: {
		label: "Login",
		fields: {
			"secret-key": {
				label: "Secret key",
				help: "Signs login sessions; changing it logs everyone out.",
			},
			users: {
				label: "Users",
				keyLabel: "Username",
				fields: {
					password: {
						label: "Password",
						help: "Plain text; prefer a password hash.",
					},
					"password-hash": { label: "Password hash", help: "A bcrypt hash." },
				},
			},
		},
	},
	document: {
		label: "Document",
		fields: {
			head: {
				label: "Extra <head> HTML",
				warning: "Scripts here run on every page of your dashboard.",
			},
		},
	},
	theme: {
		label: "Theme",
		fields: {
			...THEME_FIELDS,
			"custom-css-file": {
				label: "Custom CSS file",
				placeholder: "/assets/custom.css",
			},
			"disable-picker": { label: "Hide the theme picker" },
			presets: {
				label: "Presets",
				keyLabel: "Preset name",
				fields: THEME_FIELDS,
			},
		},
	},
	branding: {
		label: "Branding",
		fields: {
			"hide-footer": { label: "Hide the footer" },
			"custom-footer": { label: "Custom footer (HTML)" },
			"logo-text": { label: "Logo text", placeholder: "G" },
			"logo-url": { label: "Logo image", help: "Replaces the logo text." },
			"favicon-url": { label: "Favicon" },
			"app-name": { label: "App name", placeholder: "Glance" },
			"app-icon-url": {
				label: "App icon",
				help: "Used when the dashboard is installed as an app.",
			},
			"app-background-color": {
				label: "App background",
				placeholder: "#151519",
				help: "A CSS color, used when the dashboard is installed as an app; the theme background when empty.",
			},
		},
	},
	pages: { hidden: "Edited on the canvas and with the page tabs." },
};

/** All overrides, as the generator reads them. */
export const OVERRIDES: Overrides = {
	base: BASE,
	widgets: WIDGETS,
	page: PAGE,
	config: CONFIG,
};
