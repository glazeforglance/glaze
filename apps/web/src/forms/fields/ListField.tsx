import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import {
	ChevronDownIcon,
	PlusIcon,
	TrashIcon,
} from "../../components/ui/icons.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { focusAfterRemove, moveIndexes, removeIndex } from "../list-state.ts";
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
	/** The fields of one item; `itemName` is e.g. `sites.2`, `item` its current value. */
	readonly children: (
		itemName: string,
		index: number,
		item: unknown,
	) => ReactNode;
}

/** Where focus goes once the list shows the result of an action. */
type PendingFocus =
	| { readonly kind: "add" }
	| {
			readonly kind: "field" | "up" | "down" | "remove";
			readonly index: number;
	  };

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
	const root = useRef<HTMLDivElement | null>(null);
	const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(null);

	// The list only changes after the store edit has flowed back into the form,
	// so focus is moved once the new items are on screen, not in the click handler.
	// Selectors start at :scope so a nested list (bookmark links) never matches.
	useEffect(() => {
		if (!pendingFocus || !root.current) return;
		const find = (selector: string) =>
			root.current?.querySelector<HTMLElement>(selector) ?? null;
		let target: HTMLElement | null;
		if (pendingFocus.kind === "add") {
			target = find(':scope > [data-list-action="add"]');
		} else {
			const item = find(
				`:scope > ul > [data-list-index="${pendingFocus.index}"]`,
			);
			if (!item) return;
			target =
				pendingFocus.kind === "field"
					? item.querySelector<HTMLElement>(
							"input:not(:disabled), select:not(:disabled), [role=radio]:not(:disabled)",
						)
					: (item.querySelector<HTMLElement>(
							`:scope > div > [data-list-action="${pendingFocus.kind}"]:not(:disabled)`,
						) ??
						item.querySelector<HTMLElement>(
							":scope > div > [data-list-action]:not(:disabled)",
						));
		}
		target?.focus();
		setPendingFocus(null);
	}, [pendingFocus, list.items]);

	const add = () => {
		const index = list.items.length;
		if (!list.add(newItem())) return;
		setOpen((current) => new Set(current).add(index));
		setPendingFocus({ kind: "field", index });
	};
	const move = (index: number, to: number, kind: "up" | "down") => {
		if (!list.move(index, to)) return;
		setOpen((current) => moveIndexes(current, index, to));
		setPendingFocus({ kind, index: to });
	};
	const remove = (index: number) => {
		if (!list.remove(index)) return;
		setOpen((current) => removeIndex(current, index));
		const next = focusAfterRemove(index, list.items.length - 1);
		setPendingFocus(
			next === null ? { kind: "add" } : { kind: "remove", index: next },
		);
	};

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
			<div ref={root}>
				<ul aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
					{list.items.map((item, index) => {
						const title = itemTitle(item, index);
						const subtitle = itemSubtitle?.(item, index) ?? null;
						const bodyId = `${id}-item-${index}`;
						return (
							// Items have no ids of their own; the index is their identity in the YAML too.
							<li
								key={index}
								data-list-index={index}
								className="rounded-md border border-line bg-card"
							>
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
										data-list-action="up"
										disabled={list.disabled || index === 0}
										onClick={() => move(index, index - 1, "up")}
										className={ICON_BUTTON}
									>
										<ChevronDownIcon className="size-3 rotate-180" />
									</button>
									<button
										type="button"
										aria-label={`Move ${title} down`}
										data-list-action="down"
										disabled={list.disabled || index === last}
										onClick={() => move(index, index + 1, "down")}
										className={ICON_BUTTON}
									>
										<ChevronDownIcon className="size-3" />
									</button>
									<button
										type="button"
										aria-label={`Remove ${title}`}
										data-list-action="remove"
										disabled={list.disabled}
										onClick={() => remove(index)}
										className={`${ICON_BUTTON} hover:text-danger`}
									>
										<TrashIcon />
									</button>
								</div>
								{isOpen(index) && (
									<div id={bodyId} className="border-t border-line px-3 pt-3">
										{children(`${name}.${index}`, index, item)}
									</div>
								)}
							</li>
						);
					})}
				</ul>
				<Button
					variant="dashed"
					className="mt-2"
					data-list-action="add"
					disabled={list.disabled}
					onClick={add}
				>
					<PlusIcon /> {addLabel}
				</Button>
			</div>
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
