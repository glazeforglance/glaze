import { toNumber } from "../convert.ts";
import { ListField } from "../fields/ListField.tsx";
import { NumberField } from "../fields/NumberField.tsx";
import { SelectField } from "../fields/SelectField.tsx";
import { TextField } from "../fields/TextField.tsx";
import { ToggleField } from "../fields/ToggleField.tsx";
import { itemText } from "./item-text.ts";

/**
 * Settings of the rss widget: feeds and how many items to show.
 * @returns The fields.
 */
export function RssSettings() {
	return (
		<>
			<ListField
				name="feeds"
				label="Feeds"
				addLabel="Add feed"
				collapsible
				newItem={() => ({ url: "https://example.com/feed.xml" })}
				itemTitle={(feed) =>
					itemText(feed, "title") ?? itemText(feed, "url") ?? "Feed"
				}
				itemSubtitle={(feed) =>
					itemText(feed, "title") ? itemText(feed, "url") : null
				}
				hint="Feed headers can be edited in the YAML tab."
			>
				{(feedName) => (
					<>
						<TextField
							name={`${feedName}.url`}
							label="URL"
							placeholder="https://selfh.st/rss/"
							inputMode="url"
							mono
						/>
						<TextField
							name={`${feedName}.title`}
							label="Title"
							hint="Shown instead of the feed's own name."
						/>
						<NumberField
							name={`${feedName}.limit`}
							label="Items from this feed"
						/>
						<ToggleField
							name={`${feedName}.hide-categories`}
							label="Hide categories"
						/>
						<ToggleField
							name={`${feedName}.hide-description`}
							label="Hide descriptions"
						/>
						<TextField
							name={`${feedName}.item-link-prefix`}
							label="Item link prefix"
							hint="Put in front of item links that are relative."
							mono
						/>
						<TextField
							name={`${feedName}.thumbnail-link-prefix`}
							label="Thumbnail link prefix"
							mono
						/>
					</>
				)}
			</ListField>
			<NumberField name="limit" label="Items" placeholder="25" />
			<NumberField
				name="collapse-after"
				label="Collapse after"
				placeholder="5"
				hint="Items shown before Show more; -1 never collapses."
			/>
			<ToggleField
				name="preserve-order"
				label="Keep the order of the feeds"
				hint="Otherwise items are sorted by date."
			/>
		</>
	);
}

/**
 * Style options of the rss widget.
 * @returns The fields.
 */
export function RssStyle() {
	return (
		<>
			<SelectField
				name="style"
				label="Layout"
				defaultLabel="Vertical list (default)"
				options={[
					{ value: "detailed-list", label: "Detailed list (full columns)" },
					{
						value: "horizontal-cards",
						label: "Horizontal cards (full columns)",
					},
					{
						value: "horizontal-cards-2",
						label: "Horizontal cards 2 (full columns)",
					},
				]}
			/>
			<ToggleField
				name="single-line-titles"
				label="Titles on one line"
				hint="Only for the vertical list."
			/>
			<TextField
				name="thumbnail-height"
				label="Thumbnail height"
				hint="In rem, for the card layouts."
				parse={toNumber}
				inputMode="decimal"
				mono
			/>
			<TextField
				name="card-height"
				label="Card height"
				hint="In rem, for the card layouts."
				parse={toNumber}
				inputMode="decimal"
				mono
			/>
		</>
	);
}
