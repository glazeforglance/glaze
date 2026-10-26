import { type ReactNode, useId, useState } from "react";
import {
	ChevronDownIcon,
	PlusIcon,
	TrashIcon,
} from "../../components/ui/icons.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { useWidgetList } from "../use-widget-form.ts";
import { FieldShell } from "./FieldShell.tsx";

export interface ListFieldProps {
	/** Field name of the list, e.g. `sites` or `groups.0.links`. */
	readonly name: string;
	readonly label: string;
	/** Text of the add button, e.g. "Add site". */
	readonly addLabel: string;
	/** The item written by the add button. */
	readonly newItem: () => unknown;
	/** Name of an item in its header and in button labels. */
	readonly itemTitle: (item: unknown, index: number) => string;
	/** Short text next to the title, e.g. a URL. */
	readonly itemSubtitle?: (item: unknown, index: number) => string | null;
	/** Starts items folded, for long lists of big items (bookmark groups). */
	readonly collapsible?: boolean;
	readonly hint?: string;
	/** The fields of one item; `itemName` is e.g. `sites.2`. */
	readonly children: (itemName: string, index: number) => ReactNode;
}

const ICON_BUTTON =
	"inline-flex size-8 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-card-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Edits a list option: one card per item with its own fields, buttons to
 * reorder and remove, and an add button (the mock's Sites list). Every button
 * is one nested edit in the YAML, so the other items stay byte for byte.
 * @param props - List name, labels and the item fields.
 * @returns The list element.
 */
export function ListField({
	name,
	label,
	addLabel,
	newItem,
	itemTitle,
	itemSubtitle,
	collapsible = false,
	hint,
	children,
}: ListFieldProps) {
	const id = useId();
	const list = useWidgetList(name);
	const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());
	const isOpen = (index: number) => !collapsible || open.has(index);
	const toggle = (index: number) =>
		setOpen((current) => {
			const next = new Set(current);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return next;
		});
	const last = list.items.length - 1;

	return (
		<FieldShell
			inputId={id}
			label={label}
			asGroup
			status={list.status}
			hint={hint}
			aside={list.items.length}
			readOnly={list.readOnly}
			onOverride={list.override}
		>
			<ul aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
				{list.items.map((item, index) => {
					const title = itemTitle(item, index);
					const subtitle = itemSubtitle?.(item, index) ?? null;
					const bodyId = `${id}-item-${index}`;
					return (
						// Items have no ids of their own; the index is their identity in the YAML too.
						<li key={index} className="rounded-md border border-line bg-card">
							<div className="flex min-h-11 items-center gap-1 py-1 pr-1 pl-3">
								{collapsible ? (
									<button
										type="button"
										aria-expanded={isOpen(index)}
										aria-controls={bodyId}
										onClick={() => toggle(index)}
										className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
									>
										<ChevronDownIcon
											className={`size-3 shrink-0 text-muted transition-transform ${isOpen(index) ? "" : "-rotate-90"}`}
										/>
										<ItemHeading title={title} subtitle={subtitle} />
									</button>
								) : (
									<div className="flex min-w-0 flex-1 items-center gap-2">
										<ItemHeading title={title} subtitle={subtitle} />
									</div>
								)}
								<button
									type="button"
									aria-label={`Move ${title} up`}
									disabled={list.disabled || index === 0}
									onClick={() => list.move(index, index - 1)}
									className={ICON_BUTTON}
								>
									<ChevronDownIcon className="size-3 rotate-180" />
								</button>
								<button
									type="button"
									aria-label={`Move ${title} down`}
									disabled={list.disabled || index === last}
									onClick={() => list.move(index, index + 1)}
									className={ICON_BUTTON}
								>
									<ChevronDownIcon className="size-3" />
								</button>
								<button
									type="button"
									aria-label={`Remove ${title}`}
									disabled={list.disabled}
									onClick={() => list.remove(index)}
									className={`${ICON_BUTTON} hover:text-danger`}
								>
									<TrashIcon />
								</button>
							</div>
							{isOpen(index) && (
								<div id={bodyId} className="border-t border-line px-3 pt-3">
									{children(`${name}.${index}`, index)}
								</div>
							)}
						</li>
					);
				})}
			</ul>
			<Button
				variant="dashed"
				className="mt-2"
				disabled={list.disabled}
				onClick={() => list.add(newItem())}
			>
				<PlusIcon /> {addLabel}
			</Button>
		</FieldShell>
	);
}

function ItemHeading({
	title,
	subtitle,
}: {
	readonly title: string;
	readonly subtitle: string | null;
}) {
	return (
		<span className="flex min-w-0 flex-1 items-baseline gap-2">
			<span className="truncate text-sm font-semibold">{title}</span>
			{subtitle && (
				<span className="truncate font-mono text-[11px] text-faint">
					{subtitle}
				</span>
			)}
		</span>
	);
}
