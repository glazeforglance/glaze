import { fromNumberList, toNumberList } from "../convert.ts";
import { DurationField } from "../fields/DurationField.tsx";
import { ListField } from "../fields/ListField.tsx";
import { SegmentedField } from "../fields/SegmentedField.tsx";
import { TextField } from "../fields/TextField.tsx";
import { ToggleField } from "../fields/ToggleField.tsx";
import { ICON_HINT } from "./icon-hint.ts";
import { itemText } from "./item-text.ts";

/**
 * Settings of the monitor widget, in the order of the mock: layout, the
 * sites to check, and the failing-only switch.
 * @returns The fields.
 */
export function MonitorSettings() {
	return (
		<>
			<SegmentedField
				name="style"
				label="Layout"
				glanceDefault=""
				segments={[
					{ value: "", label: "Default" },
					{ value: "compact", label: "Compact" },
				]}
			/>
			<ListField
				name="sites"
				label="Sites"
				addLabel="Add site"
				collapsible
				newItem={() => ({ title: "New site", url: "https://example.com" })}
				itemTitle={(item) => itemText(item, "title") ?? "Site"}
				itemSubtitle={(item) => itemText(item, "url")}
			>
				{(itemName) => (
					<>
						<TextField name={`${itemName}.title`} label="Title" />
						<TextField
							name={`${itemName}.url`}
							label="URL"
							placeholder="https://immich.example.com"
							hint="Opens when the site is clicked; also checked, unless a check URL is set."
							inputMode="url"
							mono
						/>
						<TextField
							name={`${itemName}.check-url`}
							label="Check URL"
							placeholder="http://immich:2283/api/server/ping"
							hint="Checked instead of the URL, e.g. an internal address."
							inputMode="url"
							mono
						/>
						<TextField
							name={`${itemName}.icon`}
							label="Icon"
							placeholder="si:immich"
							hint={ICON_HINT}
							mono
						/>
						<TextField
							name={`${itemName}.error-url`}
							label="Error URL"
							hint="Opens instead of the URL while the site is down."
							inputMode="url"
							mono
						/>
						<DurationField
							name={`${itemName}.timeout`}
							label="Timeout"
							defaultLabel="3 seconds (default)"
							scale="short"
						/>
						<TextField
							name={`${itemName}.alt-status-codes`}
							label="Also OK"
							placeholder="401, 403"
							hint="Status codes that count as up, besides 200."
							parse={toNumberList}
							format={fromNumberList}
							mono
						/>
						<ToggleField
							name={`${itemName}.allow-insecure`}
							label="Allow invalid certificates"
						/>
						<ToggleField
							name={`${itemName}.same-tab`}
							label="Open in the same tab"
						/>
						<TextField
							name={`${itemName}.basic-auth.username`}
							label="Basic auth user"
						/>
						<TextField
							name={`${itemName}.basic-auth.password`}
							label="Basic auth password"
							secret
						/>
					</>
				)}
			</ListField>
			<ToggleField name="show-failing-only" label="Only show failing sites" />
		</>
	);
}
