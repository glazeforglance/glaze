import { ListField } from "../fields/ListField.tsx";
import { SegmentedField } from "../fields/SegmentedField.tsx";
import { TextField } from "../fields/TextField.tsx";
import { itemText } from "./item-text.ts";

/**
 * Settings of the clock widget.
 * @returns The fields.
 */
export function ClockSettings() {
	return (
		<>
			<SegmentedField
				name="hour-format"
				label="Hour format"
				glanceDefault="24h"
				segments={[
					{ value: "24h", label: "24h" },
					{ value: "12h", label: "12h" },
				]}
			/>
			<ListField
				name="timezones"
				label="Other timezones"
				addLabel="Add timezone"
				newItem={() => ({ timezone: "UTC" })}
				itemTitle={(item) =>
					itemText(item, "label") ?? itemText(item, "timezone") ?? "Timezone"
				}
				itemSubtitle={(item) => itemText(item, "timezone")}
			>
				{(itemName) => (
					<>
						<TextField
							name={`${itemName}.timezone`}
							label="Timezone"
							placeholder="Europe/Amsterdam"
							hint="A name from the tz database."
							mono
						/>
						<TextField name={`${itemName}.label`} label="Label" />
					</>
				)}
			</ListField>
		</>
	);
}
