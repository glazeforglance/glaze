import { type KeyboardEvent, useId, useRef } from "react";
import { parentWidget } from "../lib/model.ts";
import { fractionSymbol, type WidgetWidth } from "../lib/widget-width.ts";
import { selectCurrentPage, useEditor } from "../store/editor-store.ts";
import { useWidgetForm } from "./use-widget-form.ts";

const CHOICES: readonly { value: WidgetWidth; label: string }[] = [
	{ value: "full", label: "Full" },
	{ value: 2, label: "½" },
	{ value: 3, label: "⅓" },
	{ value: 4, label: "¼" },
];

/**
 * The widget's width in its column, for keyboard users and as an overview:
 * Full, or ½ / ⅓ / ¼ through a split-column (the same as the resize handle
 * on the canvas). For a split-column itself it sets how many columns it has.
 * Not offered where Glance or Glaze don't allow it (in a group, in head widgets).
 * @returns The field.
 */
export function WidthField() {
	const { widget, readOnly } = useWidgetForm();
	const page = useEditor(selectCurrentPage);
	const setWidgetWidth = useEditor((state) => state.setWidgetWidth);
	const setSplitColumns = useEditor((state) => state.setSplitColumns);
	const unwrapSplit = useEditor((state) => state.unwrapSplit);
	const id = useId();
	const buttons = useRef<(HTMLButtonElement | null)[]>([]);
	if (!page) return null;

	const parent = parentWidget(page, widget);
	const inHead = widget.path[widget.path.length - 2] === "head-widgets";
	const isSplit = widget.type === "split-column";
	const choices = isSplit
		? CHOICES.filter((choice) => choice.value !== "full")
		: CHOICES;
	const current: WidgetWidth | null = isSplit
		? toWidth(widget.maxColumns)
		: parent?.type === "split-column"
			? toWidth(parent.maxColumns)
			: "full";
	const blocked =
		parent?.type === "group"
			? "Widgets in a group are tabs and share the group's width."
			: inHead
				? "Head widgets can't be split; they stay one row above the columns."
				: null;
	const shared =
		isSplit || parent?.type === "split-column"
			? ((isSplit ? widget : parent)?.children.length ?? 0)
			: 0;
	// A split-column inside another split-column: its own width comes from the outer one.
	const nestedSplit = isSplit && parent?.type === "split-column";

	const choose = (value: WidgetWidth) => {
		if (isSplit) {
			if (value !== "full") setSplitColumns(widget.id, value);
		} else {
			setWidgetWidth(widget.id, value);
		}
	};

	const selectedIndex = choices.findIndex((choice) => choice.value === current);
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const step =
			event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
		if (step === 0) return;
		event.preventDefault();
		const next = Math.min(
			choices.length - 1,
			Math.max(0, Math.max(selectedIndex, 0) + step),
		);
		const choice = choices[next];
		if (!choice) return;
		choose(choice.value);
		buttons.current[next]?.focus();
	};

	return (
		<div className="mb-4">
			<div className="mb-1.5 flex min-h-5 items-center gap-2">
				<span
					id={`${id}-label`}
					className="font-mono text-[11px] font-semibold tracking-wider text-muted uppercase"
				>
					{isSplit ? "Columns side by side" : "Width"}
				</span>
				{current === null && (
					<span className="ml-auto font-mono text-[11px] text-faint">
						{fractionSymbol(
							(isSplit ? widget.maxColumns : parent?.maxColumns) ?? 2,
						)}
					</span>
				)}
			</div>
			<div
				role="radiogroup"
				aria-labelledby={`${id}-label`}
				aria-describedby={`${id}-hint`}
				onKeyDown={onKeyDown}
				className="grid gap-2"
				style={{
					gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))`,
				}}
			>
				{choices.map((choice, index) => {
					const selected = choice.value === current;
					const tabbable = selected || (selectedIndex === -1 && index === 0);
					return (
						<button
							key={String(choice.value)}
							ref={(element) => {
								buttons.current[index] = element;
							}}
							type="button"
							role="radio"
							aria-checked={selected}
							aria-label={
								choice.value === "full"
									? "Full width"
									: `${choice.label} width, ${choice.value} columns`
							}
							tabIndex={tabbable ? 0 : -1}
							disabled={readOnly || blocked !== null}
							onClick={() => choose(choice.value)}
							className={`min-h-10 cursor-pointer rounded-sm border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
								selected
									? "border-accent bg-accent/8 font-semibold text-accent"
									: "border-line bg-card text-muted hover:border-line-strong hover:text-text"
							}`}
						>
							{choice.label}
						</button>
					);
				})}
			</div>
			<p id={`${id}-hint`} className="mt-1 text-xs text-faint">
				{blocked ??
					(shared > 1
						? `All ${shared} widgets in this split-column share this width: Glance draws equal columns.`
						: current !== "full" && current !== null
							? "Alone in its split-column: the rest of the row stays empty until you drop a widget beside it."
							: "Glance has no width per widget; ½, ⅓ and ¼ put it in a split-column.")}
			</p>
			{isSplit && (
				<button
					type="button"
					disabled={readOnly}
					onClick={() => unwrapSplit(widget.id)}
					className="mt-2 cursor-pointer text-xs text-accent underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
				>
					Put these widgets below each other again
				</button>
			)}
			{nestedSplit && (
				<p className="mt-1 text-xs text-faint">
					This split-column sits in another split-column, which sets its outer
					width.
				</p>
			)}
		</div>
	);
}

function toWidth(columns: number | null): WidgetWidth | null {
	return columns === 2 || columns === 3 || columns === 4 ? columns : null;
}
