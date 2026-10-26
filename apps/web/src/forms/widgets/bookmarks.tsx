import { ListField } from "../fields/ListField.tsx";
import { TextField } from "../fields/TextField.tsx";
import { ToggleField } from "../fields/ToggleField.tsx";
import { ICON_HINT } from "./icon-hint.ts";
import { itemText } from "./item-text.ts";

function linkCount(group: unknown): string | null {
	const links =
		typeof group === "object" && group !== null && "links" in group
			? group.links
			: null;
	if (!Array.isArray(links)) return null;
	return links.length === 1 ? "1 link" : `${links.length} links`;
}

/**
 * Settings of the bookmarks widget: groups, each with a list of links.
 * Both levels fold, so a long list stays usable.
 * @returns The fields.
 */
export function BookmarksSettings() {
	return (
		<ListField
			name="groups"
			label="Groups"
			addLabel="Add group"
			collapsible
			newItem={() => ({ title: "New group" })}
			itemTitle={(group) => itemText(group, "title") ?? "Group"}
			itemSubtitle={linkCount}
		>
			{(groupName) => (
				<>
					<TextField name={`${groupName}.title`} label="Group title" />
					<ListField
						name={`${groupName}.links`}
						label="Links"
						addLabel="Add link"
						collapsible
						newItem={() => ({ title: "New link", url: "https://example.com" })}
						itemTitle={(link) => itemText(link, "title") ?? "Link"}
						itemSubtitle={(link) => itemText(link, "url")}
					>
						{(linkName) => (
							<>
								<TextField name={`${linkName}.title`} label="Title" />
								<TextField
									name={`${linkName}.url`}
									label="URL"
									placeholder="https://"
									inputMode="url"
									mono
								/>
								<TextField
									name={`${linkName}.description`}
									label="Description"
								/>
								<TextField
									name={`${linkName}.icon`}
									label="Icon"
									placeholder="si:jellyfin"
									hint={ICON_HINT}
									mono
								/>
								<ToggleField
									name={`${linkName}.same-tab`}
									label="Open in the same tab"
									hint="Overrides the group's setting."
								/>
								<ToggleField
									name={`${linkName}.hide-arrow`}
									label="Hide the arrow"
								/>
							</>
						)}
					</ListField>
					<TextField
						name={`${groupName}.color`}
						label="Color"
						placeholder="240 13 95"
						hint="Hue, saturation and lightness, like in Glance themes."
						mono
					/>
					<ToggleField
						name={`${groupName}.same-tab`}
						label="Open links in the same tab"
					/>
					<ToggleField
						name={`${groupName}.hide-arrow`}
						label="Hide the arrows"
					/>
				</>
			)}
		</ListField>
	);
}
