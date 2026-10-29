import type { FieldSchema } from "@glaze/schemas";
import { IconField } from "../fields/IconField.tsx";
import { MapField } from "../fields/MapField.tsx";
import { TextField } from "../fields/TextField.tsx";
import { ToggleField } from "../fields/ToggleField.tsx";
import { useTranslation } from "react-i18next";

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
	const { t } = useTranslation();
	return (
		<MapField
			name={name}
			label={field.label}
			keyLabel={t("forms.containers.name")}
			keyPlaceholder="jellyfin"
			addLabel={t("forms.map.add")}
			newEntry={(key) => ({ name: key })}
			hint={field.help}
		>
			{(entryName) => (
				<>
					<TextField
						name={`${entryName}.name`}
						label={t("forms.containers.displayName")}
					/>
					<TextField
						name={`${entryName}.url`}
						label={t("forms.containers.url")}
						placeholder="https://"
						inputMode="url"
						mono
					/>
					<TextField
						name={`${entryName}.description`}
						label={t("forms.containers.description")}
					/>
					<IconField
						name={`${entryName}.icon`}
						label={t("forms.containers.icon")}
					/>
					<ToggleField
						name={`${entryName}.hide`}
						label={t("forms.containers.hide")}
					/>
					<ToggleField
						name={`${entryName}.same-tab`}
						label={t("forms.containers.sameTab")}
					/>
					<TextField
						name={`${entryName}.parent`}
						label={t("forms.containers.parent")}
						hint={t("forms.containers.parentHint")}
						mono
					/>
					<TextField
						name={`${entryName}.id`}
						label={t("forms.containers.id")}
						mono
					/>
				</>
			)}
		</MapField>
	);
}
