import { type KeyboardEvent, useId, useRef } from "react";
import { parentWidget } from "../lib/model.ts";
import { fractionSymbol, type WidgetWidth } from "../lib/widget-width.ts";
import { selectCurrentPage, useEditor } from "../store/editor-store.ts";
import { useWidgetForm } from "./use-widget-form.ts";
import { useTranslation } from "react-i18next";
import { currentDirection } from "../i18n.ts";
import { logicalKey } from "../lib/direction.ts";

const CHOICES: readonly { value: WidgetWidth; label: string }[] = [
	// "Full" is translated where it is shown; the fractions are symbols.
	{ value: "full", label: "" },
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
	const { t } = useTranslation();
	const { widget, readOnly } = useWidgetForm();
	const page = useEditor(selectCurrentPage);
	const setWidgetWidth = useEditor((state) => state.setWidgetWidth);
	const setSplitColumns = useEditor((state) => state.setSplitColumns);
	const unwrapSplit = useEditor((state) => state.unwrapSplit);
	const id = useId();
	const buttons = useRef<(HTMLButtonElement | null)[]>([]);
	// Only in widget forms (page and settings forms have no widget).
	if (!page || !widget) return null;

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
			? t("forms.width.inGroup")
			: inHead
				? t("forms.width.inHead")
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
		const key = logicalKey(event.key, currentDirection());
		const step = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
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
					{isSplit ? t("forms.width.splitLabel") : t("forms.width.label")}
				</span>
				{current === null && (
					<span className="ms-auto font-mono text-[11px] text-faint">
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
									? t("forms.width.fullLabel")
									: t("forms.width.fractionLabel", {
											fraction: choice.label,
											count: choice.value,
										})
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
							{choice.value === "full" ? t("forms.width.full") : choice.label}
						</button>
					);
				})}
			</div>
			<p id={`${id}-hint`} className="mt-1 text-xs text-faint">
				{blocked ??
					(shared > 1
						? t("forms.width.shared", { count: shared })
						: current !== "full" && current !== null
							? t("forms.width.alone")
							: t("forms.width.noWidth"))}
			</p>
			{isSplit && (
				<button
					type="button"
					disabled={readOnly}
					onClick={() => unwrapSplit(widget.id)}
					className="mt-2 cursor-pointer text-xs text-accent underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
				>
					{t("forms.width.unwrap")}
				</button>
			)}
			{nestedSplit && (
				<p className="mt-1 text-xs text-faint">{t("forms.width.nested")}</p>
			)}
		</div>
	);
}

function toWidth(columns: number | null): WidgetWidth | null {
	return columns === 2 || columns === 3 || columns === 4 ? columns : null;
}
