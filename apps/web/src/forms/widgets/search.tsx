import { ListField } from "../fields/ListField.tsx";
import { PresetField } from "../fields/PresetField.tsx";
import { TextField } from "../fields/TextField.tsx";
import { ToggleField } from "../fields/ToggleField.tsx";
import { itemText } from "./item-text.ts";

const ENGINES = [
	{ value: "google", label: "Google" },
	{ value: "bing", label: "Bing" },
	{ value: "kagi", label: "Kagi" },
	{ value: "perplexity", label: "Perplexity" },
	{ value: "startpage", label: "Startpage" },
];

/**
 * Settings of the search widget.
 * @returns The fields.
 */
export function SearchSettings() {
	return (
		<>
			<PresetField
				name="search-engine"
				label="Search engine"
				defaultLabel="DuckDuckGo (default)"
				presets={ENGINES}
				customPlaceholder="https://example.com/search?q={QUERY}"
			/>
			<TextField
				name="placeholder"
				label="Placeholder"
				placeholder="Type here to search…"
			/>
			<ToggleField name="new-tab" label="Open results in a new tab" />
			<ToggleField name="autofocus" label="Focus the search bar on load" />
			<TextField
				name="target"
				label="Link target"
				placeholder="_blank"
				hint="Advanced: the HTML target for results. Usually empty."
				mono
			/>
			<ListField
				name="bangs"
				label="Bangs"
				addLabel="Add bang"
				newItem={() => ({
					title: "New bang",
					shortcut: "!new",
					url: "https://example.com/search?q={QUERY}",
				})}
				itemTitle={(item) =>
					itemText(item, "title") ?? itemText(item, "shortcut") ?? "Bang"
				}
				itemSubtitle={(item) => itemText(item, "shortcut")}
			>
				{(itemName) => (
					<>
						<TextField name={`${itemName}.title`} label="Title" />
						<TextField
							name={`${itemName}.shortcut`}
							label="Shortcut"
							placeholder="!yt"
							mono
						/>
						<TextField
							name={`${itemName}.url`}
							label="URL"
							placeholder="https://www.youtube.com/results?search_query={QUERY}"
							hint="{QUERY} is replaced by what you type."
							mono
						/>
					</>
				)}
			</ListField>
		</>
	);
}
