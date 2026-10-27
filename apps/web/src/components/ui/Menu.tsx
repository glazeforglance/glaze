import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { CheckIcon } from "./icons.tsx";

/** One entry in a `Menu`. */
export interface MenuItem {
	readonly label: string;
	readonly onSelect: () => void;
	/** Shown in red, for destructive actions. */
	readonly danger?: boolean;
	/** Makes the item a choice (`menuitemradio`); `true` shows a check mark. */
	readonly checked?: boolean;
	readonly disabled?: boolean;
}

export interface MenuProps {
	/** Accessible name of the trigger button and the menu. */
	readonly label: string;
	readonly trigger: ReactNode;
	readonly items: readonly MenuItem[];
	readonly triggerClassName?: string;
	/** Which edge of the trigger the menu lines up with. */
	readonly align?: "left" | "right";
	/** Non-interactive text above the items, e.g. who is signed in. */
	readonly header?: ReactNode;
}

/**
 * A button that opens a small menu (WAI-ARIA menu button pattern): arrow keys,
 * Home/End and Escape work, focus returns to the button, and clicking outside closes it.
 * @param props - Trigger, label and items.
 * @returns The menu button with its menu.
 */
export function Menu({
	label,
	trigger,
	items,
	triggerClassName = "",
	align = "left",
	header,
}: MenuProps) {
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const menuId = useId();

	useEffect(() => {
		if (!open) return;
		listRef.current
			?.querySelector<HTMLButtonElement>("button:not([disabled])")
			?.focus();
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (
				!listRef.current?.contains(target) &&
				!triggerRef.current?.contains(target)
			) {
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		return () => document.removeEventListener("pointerdown", onPointerDown);
	}, [open]);

	const close = (focusTrigger: boolean) => {
		setOpen(false);
		if (focusTrigger) triggerRef.current?.focus();
	};

	const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
		const buttons = [
			...(listRef.current?.querySelectorAll<HTMLButtonElement>(
				"button:not([disabled])",
			) ?? []),
		];
		const current = buttons.findIndex(
			(button) => button === document.activeElement,
		);
		const focusAt = (index: number) =>
			buttons[(index + buttons.length) % buttons.length]?.focus();
		if (event.key === "ArrowDown") focusAt(current + 1);
		else if (event.key === "ArrowUp") focusAt(current - 1);
		else if (event.key === "Home") focusAt(0);
		else if (event.key === "End") focusAt(buttons.length - 1);
		else if (event.key === "Escape") close(true);
		else if (event.key === "Tab") close(false);
		else return;
		if (event.key !== "Tab") event.preventDefault();
	};

	return (
		<div className="relative">
			<button
				ref={triggerRef}
				type="button"
				aria-label={label}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={open ? menuId : undefined}
				onClick={() => setOpen((value) => !value)}
				className={`cursor-pointer ${triggerClassName}`}
			>
				{trigger}
			</button>
			{open && (
				<ul
					id={menuId}
					ref={listRef}
					role="menu"
					aria-label={label}
					onKeyDown={onKeyDown}
					className={`absolute top-full z-30 mt-1 max-h-80 min-w-44 overflow-y-auto rounded-md border border-line-strong bg-card p-1 shadow-xl shadow-black/50 ${
						align === "right" ? "right-0" : "left-0"
					}`}
				>
					{header !== undefined && (
						<li
							role="presentation"
							className="mb-1 border-b border-line px-2.5 pt-1.5 pb-2 text-xs text-muted"
						>
							{header}
						</li>
					)}
					{items.map((item) => (
						<li key={item.label} role="none">
							<button
								type="button"
								role={item.checked === undefined ? "menuitem" : "menuitemradio"}
								aria-checked={item.checked}
								disabled={item.disabled}
								onClick={() => {
									close(true);
									item.onSelect();
								}}
								className={`flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-sm px-2.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
									item.danger
										? "text-danger hover:bg-danger/10"
										: "text-text hover:bg-card-hover"
								}`}
							>
								<span className="w-3.5 text-accent">
									{item.checked && <CheckIcon />}
								</span>
								{item.label}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
