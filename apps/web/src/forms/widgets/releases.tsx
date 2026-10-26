import { useId } from "react";
import { ListField } from "../fields/ListField.tsx";
import { NumberField } from "../fields/NumberField.tsx";
import { TextField } from "../fields/TextField.tsx";
import { ToggleField } from "../fields/ToggleField.tsx";
import { useWidgetField } from "../use-widget-form.ts";
import { itemText } from "./item-text.ts";

const REPOSITORY_HINT =
	"owner/repo for GitHub; start with gitlab:, dockerhub: or codeberg: for other sources.";

// Glance 0.8.7 only reads the source prefix from the plain string form, so
// the map form (needed for pre-releases) only works for GitHub.
function canIncludePrereleases(repository: string | null): boolean {
	return (
		repository === null ||
		!repository.includes(":") ||
		repository.startsWith("github:")
	);
}

/**
 * The pre-release switch for a repository written as a plain string: turning
 * it on rewrites the item as `{ repository, include-prereleases: true }`.
 */
function StringPrereleaseToggle({
	itemName,
	repository,
}: {
	readonly itemName: string;
	readonly repository: string;
}) {
	const id = useId();
	const widgetField = useWidgetField(itemName);
	return (
		<div className="mb-4 flex min-h-10 items-center gap-3">
			<input
				id={id}
				type="checkbox"
				checked={false}
				disabled={widgetField.disabled}
				onChange={() =>
					widgetField.commit({
						repository,
						"include-prereleases": true,
					})
				}
				className="size-5 shrink-0 cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-card disabled:cursor-not-allowed disabled:opacity-60"
			/>
			<label htmlFor={id} className="cursor-pointer text-sm">
				Include pre-releases
			</label>
		</div>
	);
}

/**
 * Settings of the releases widget: repositories and the API tokens.
 * @returns The fields.
 */
export function ReleasesSettings() {
	return (
		<>
			<ListField
				name="repositories"
				label="Repositories"
				addLabel="Add repository"
				newItem={() => "owner/repository"}
				itemTitle={(item) =>
					itemText(item) ?? itemText(item, "repository") ?? "Repository"
				}
			>
				{(itemName, _index, item) => {
					const plain = typeof item === "string";
					const repository = plain ? item : itemText(item, "repository");
					return (
						<>
							<TextField
								name={plain ? itemName : `${itemName}.repository`}
								label="Repository"
								placeholder="glanceapp/glance"
								hint={REPOSITORY_HINT}
								mono
							/>
							{canIncludePrereleases(repository) &&
								(plain ? (
									<StringPrereleaseToggle
										itemName={itemName}
										repository={item}
									/>
								) : (
									<ToggleField
										name={`${itemName}.include-prereleases`}
										label="Include pre-releases"
									/>
								))}
						</>
					);
				}}
			</ListField>
			<TextField
				name="token"
				label="GitHub token"
				hint="Raises GitHub's rate limit. Tip: write ${GITHUB_TOKEN} so the key stays out of glance.yml."
				secret
			/>
			<TextField
				name="gitlab-token"
				label="GitLab token"
				hint="Tip: write ${GITLAB_TOKEN} so the key stays out of glance.yml."
				secret
			/>
			<NumberField name="limit" label="Releases" placeholder="10" />
			<NumberField
				name="collapse-after"
				label="Collapse after"
				placeholder="5"
				hint="Releases shown before Show more; -1 never collapses."
			/>
		</>
	);
}

/**
 * Style options of the releases widget.
 * @returns The fields.
 */
export function ReleasesStyle() {
	return (
		<ToggleField
			name="show-source-icon"
			label="Show the source icon"
			hint="GitHub, GitLab, Docker Hub or Codeberg."
		/>
	);
}
