import { type FormEvent, type ReactNode, useId, useState } from "react";
import { Button } from "../../components/ui/Button.tsx";
import {
	ChevronDownIcon,
	PlusIcon,
	TrashIcon,
} from "../../components/ui/icons.tsx";
import { checkNewMapKey, isFormSafeKey } from "../map-keys.ts";
import { useWidgetMap } from "../use-widget-form.ts";
import { borderClass, INPUT_CLASS } from "./field-styles.ts";
import { FieldShell } from "./FieldShell.tsx";

export interface MapFieldProps {
	/** Field name of the map, e.g. `containers`. */
	readonly name: string;
	readonly label: string;
	/** Label of the name input, e.g. "Container name". */
	readonly keyLabel: string;
	readonly keyPlaceholder?: string;
	readonly addLabel: string;
	/** The value written for a new entry with key `key`; never an empty map, which YAML writes as `{}`. */
	readonly newEntry: (key: string) => unknown;
	readonly hint?: string;
	/** The fields of one entry; `entryName` is e.g. `containers.jellyfin`. */
	readonly children: (entryName: string, key: string) => ReactNode;
}

const ICON_BUTTON =
	"inline-flex size-8 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-card-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Edits a map whose keys are names the user picks, e.g. docker-containers
 * `containers` (container name → labels). Entries fold open one at a time;
 * keys are added and removed, but renamed in the YAML tab.
 * @param props - Map name, labels and the entry fields.
 * @returns The map element.
 */
export function MapField({
	name,
	label,
	keyLabel,
	keyPlaceholder,
	addLabel,
	newEntry,
	hint,
	children,
}: MapFieldProps) {
	const id = useId();
	const map = useWidgetMap(name);
	const [open, setOpen] = useState<string | null>(null);
	const [draft, setDraft] = useState("");
	const [draftError, setDraftError] = useState<string | null>(null);
	// The entry being renamed, with the new name typed so far.
	const [renaming, setRenaming] = useState<{
		from: string;
		to: string;
		error: string | null;
	} | null>(null);
	const keys = map.entries.map(([key]) => key);

	const onRename = () => {
		if (!renaming) return;
		const to = renaming.to.trim();
		if (to === renaming.from) {
			setRenaming(null);
			return;
		}
		const message = checkNewMapKey(
			to,
			keys.filter((key) => key !== renaming.from),
		);
		if (message !== null) {
			setRenaming({ ...renaming, error: message });
			return;
		}
		if (map.rename(renaming.from, to)) {
			if (open === renaming.from) setOpen(to);
			setRenaming(null);
		}
	};

	const onAdd = (event: FormEvent) => {
		event.preventDefault();
		const message = checkNewMapKey(draft, keys);
		setDraftError(message);
		if (message !== null) return;
		const key = draft.trim();
		if (map.add(key, newEntry(key))) {
			setDraft("");
			setOpen(key);
		}
	};

	return (
		<FieldShell
			inputId={id}
			label={label}
			asGroup
			status={map.status}
			hint={hint}
			aside={map.entries.length}
			readOnly={map.readOnly}
			onOverride={map.override}
		>
			<ul aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
				{map.entries.map(([key]) => {
					const editable = isFormSafeKey(key);
					const isOpen = (open === key || map.expandAll) && editable;
					const bodyId = `${id}-${key}`;
					return (
						<li key={key} className="rounded-md border border-line bg-card">
							<div className="flex min-h-11 items-center gap-1 py-1 pr-1 pl-3">
								{renaming?.from === key ? (
									<input
										aria-label={`New ${keyLabel.toLowerCase()} for ${key}`}
										value={renaming.to}
										// Focus moves into the input that replaces the button just pressed.
										autoFocus
										spellCheck={false}
										onChange={(event) =>
											setRenaming({
												from: key,
												to: event.target.value,
												error: null,
											})
										}
										onBlur={onRename}
										onKeyDown={(event) => {
											if (event.key === "Enter") {
												event.preventDefault();
												onRename();
											} else if (event.key === "Escape") {
												event.preventDefault();
												setRenaming(null);
											}
										}}
										className={`${INPUT_CLASS} ${borderClass(renaming.error !== null)} min-h-9 flex-1 font-mono text-[13px]`}
									/>
								) : (
									<button
										type="button"
										aria-expanded={isOpen}
										aria-controls={bodyId}
										disabled={!editable}
										title={
											editable ? undefined : "Edit this one in the YAML tab"
										}
										onClick={() => setOpen(isOpen ? null : key)}
										className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 text-left disabled:cursor-default"
									>
										<ChevronDownIcon
											className={`size-3 shrink-0 text-muted transition-transform ${isOpen ? "" : "-rotate-90"}`}
										/>
										<span className="truncate font-mono text-sm">{key}</span>
									</button>
								)}
								<button
									type="button"
									aria-label={`Rename ${key}`}
									title="Rename"
									disabled={map.disabled || !editable}
									onClick={() =>
										setRenaming({ from: key, to: key, error: null })
									}
									className={`${ICON_BUTTON} font-mono text-[11px]`}
								>
									Aa
								</button>
								<button
									type="button"
									aria-label={`Remove ${key}`}
									disabled={map.disabled}
									onClick={() => map.remove(key)}
									className={`${ICON_BUTTON} hover:text-danger`}
								>
									<TrashIcon />
								</button>
							</div>
							{isOpen && (
								<div id={bodyId} className="border-t border-line px-3 pt-3">
									{children(`${name}.${key}`, key)}
								</div>
							)}
						</li>
					);
				})}
			</ul>
			{renaming?.error && (
				<p role="alert" className="mt-1 text-xs text-danger">
					{renaming.error}
				</p>
			)}
			{/* A nested <form> isn't allowed, so this is a group that handles Enter itself. */}
			<div className="mt-2 flex gap-2">
				<input
					aria-label={keyLabel}
					value={draft}
					placeholder={keyPlaceholder}
					disabled={map.disabled}
					autoComplete="off"
					spellCheck={false}
					aria-invalid={draftError ? true : undefined}
					onChange={(event) => {
						setDraft(event.target.value);
						setDraftError(null);
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter") onAdd(event);
						else if (event.key === "Escape") {
							event.preventDefault();
							setDraft("");
							setDraftError(null);
						}
					}}
					className={`${INPUT_CLASS} ${borderClass(draftError !== null)} font-mono text-[13px]`}
				/>
				<Button
					variant="secondary"
					disabled={map.disabled}
					onClick={onAdd}
					className="shrink-0"
				>
					<PlusIcon /> {addLabel}
				</Button>
			</div>
			{draftError && (
				<p role="alert" className="mt-1 text-xs text-danger">
					{draftError}
				</p>
			)}
		</FieldShell>
	);
}
