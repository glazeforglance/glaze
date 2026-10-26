import { SelectField } from "../fields/SelectField.tsx";
import { WEEKDAYS } from "./calendar.schema.ts";

const OPTIONS = WEEKDAYS.filter((day) => day !== "monday").map((day) => ({
	value: day,
	label: day.charAt(0).toUpperCase() + day.slice(1),
}));

/**
 * Settings of the calendar widget.
 * @returns The fields.
 */
export function CalendarSettings() {
	return (
		<SelectField
			name="first-day-of-week"
			label="First day of the week"
			defaultLabel="Monday (default)"
			options={OPTIONS}
		/>
	);
}
