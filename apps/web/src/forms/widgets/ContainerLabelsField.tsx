import type { FieldSchema } from "@glaze/schemas";
import { IconField } from "../fields/IconField.tsx";
import { MapField } from "../fields/MapField.tsx";
import { TextField } from "../fields/TextField.tsx";
import { ToggleField } from "../fields/ToggleField.tsx";

/**
 * docker-containers `containers`: Glance labels per container name, set in
 * the config instead of as `glance.*` labels on the containers. In the Go
 * source this is a plain map of strings, so the label names (from Glance's
 * docs) are listed here.
 * @param props - The option's schema and form name.
 * @returns The map editor.
 */
export function ContainerLabelsField({
	field,
	name,
}: {
	readonly field: FieldSchema;
	readonly name: string;
}) {
	return (
		<MapField
			name={name}
			label={field.label}
			keyLabel="Container name"
			keyPlaceholder="jellyfin"
			addLabel="Add"
			newEntry={(key) => ({ name: key })}
			hint={field.help}
		>
			{(entryName) => (
				<>
					<TextField name={`${entryName}.name`} label="Display name" />
					<TextField
						name={`${entryName}.url`}
						label="URL"
						placeholder="https://"
						inputMode="url"
						mono
					/>
					<TextField name={`${entryName}.description`} label="Description" />
					<IconField name={`${entryName}.icon`} label="Icon" />
					<ToggleField name={`${entryName}.hide`} label="Hide this container" />
					<ToggleField
						name={`${entryName}.same-tab`}
						label="Open in the same tab"
					/>
					<TextField
						name={`${entryName}.parent`}
						label="Parent"
						hint="The glance.id of a container to show this one under."
						mono
					/>
					<TextField name={`${entryName}.id`} label="Id" mono />
				</>
			)}
		</MapField>
	);
}
