import { SegmentedField } from "../fields/SegmentedField.tsx";
import { TextField } from "../fields/TextField.tsx";
import { ToggleField } from "../fields/ToggleField.tsx";

/**
 * Settings of the weather widget.
 * @returns The fields.
 */
export function WeatherSettings() {
	return (
		<>
			<TextField
				name="location"
				label="Location"
				placeholder="Amsterdam, Netherlands"
				hint="City and country; add the area for small places."
			/>
			<SegmentedField
				name="units"
				label="Units"
				glanceDefault="metric"
				segments={[
					{ value: "metric", label: "Metric (°C)" },
					{ value: "imperial", label: "Imperial (°F)" },
				]}
			/>
			<SegmentedField
				name="hour-format"
				label="Hour format"
				glanceDefault="12h"
				segments={[
					{ value: "12h", label: "12h" },
					{ value: "24h", label: "24h" },
				]}
			/>
		</>
	);
}

/**
 * Style options of the weather widget.
 * @returns The fields.
 */
export function WeatherStyle() {
	return (
		<>
			<ToggleField name="show-area-name" label="Show the area name" />
			<ToggleField name="hide-location" label="Hide the location" />
		</>
	);
}
