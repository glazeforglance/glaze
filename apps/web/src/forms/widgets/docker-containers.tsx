import { MapField } from "../fields/MapField.tsx";
import { TextField } from "../fields/TextField.tsx";
import { ToggleField } from "../fields/ToggleField.tsx";
import { ICON_HINT } from "./icon-hint.ts";

/**
 * Settings of the docker-containers widget, plus per-container labels set in
 * the config (`containers:`) instead of on the containers themselves.
 * @returns The fields.
 */
export function DockerContainersSettings() {
	return (
		<>
			<TextField
				name="sock-path"
				label="Docker socket"
				placeholder="/var/run/docker.sock"
				hint="Or a remote address such as tcp://docker-proxy:2375."
				mono
			/>
			<TextField
				name="category"
				label="Category"
				hint="Only show containers with this glance.category label."
			/>
			<ToggleField name="running-only" label="Only running containers" />
			<ToggleField
				name="hide-by-default"
				label="Hide containers by default"
				hint="Then only containers with glance.hide: false are shown."
			/>
			<MapField
				name="containers"
				label="Container labels"
				keyLabel="Container name"
				keyPlaceholder="jellyfin"
				addLabel="Add"
				newEntry={(key) => ({ name: key })}
				hint="Labels for a container by name, instead of glance.* labels on the container."
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
						<TextField
							name={`${entryName}.icon`}
							label="Icon"
							placeholder="di:jellyfin"
							hint={ICON_HINT}
							mono
						/>
						<ToggleField
							name={`${entryName}.hide`}
							label="Hide this container"
						/>
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
		</>
	);
}

/**
 * Style options of the docker-containers widget.
 * @returns The fields.
 */
export function DockerContainersStyle() {
	return (
		<ToggleField
			name="format-container-names"
			label="Tidy up container names"
			hint="Replaces _ and - with spaces and capitalizes words: my_app-1 becomes My App 1."
		/>
	);
}
