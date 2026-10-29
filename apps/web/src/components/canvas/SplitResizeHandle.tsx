import type { KeyboardEvent, PointerEvent } from "react";
import { useState } from "react";
import {
	fractionSymbol,
	snapColumns,
	stepColumns,
	widthLabel,
} from "../../lib/widget-width.ts";
import { useEditor } from "../../store/editor-store.ts";
import { useTranslation } from "react-i18next";
import { currentDirection } from "../../i18n.ts";
import { inlineDelta, inlineStartX, logicalKey } from "../../lib/direction.ts";

export interface SplitResizeHandleProps {
	/** The split-column whose `max-columns` this handle changes. */
	readonly splitId: string;
	readonly columns: number;
	/** How many widgets share the width, for the notice. */
	readonly count: number;
	/** Name of the selected widget, for screen readers. */
	readonly title: string;
}

/**
 * The handle on the inline-end edge of a selected widget in a split-column
 * (the right edge in LTR, the left edge in RTL).
 * Dragging it snaps the width to ½, ⅓ or ¼ of the split-column, which sets
 * the split-column's `max-columns` (2, 3 or 4) on release. Glance gives every
 * widget in a split-column the same width, so a notice says so while dragging.
 * Keyboard: Left/Right make it narrower/wider (mirrored in RTL), Home/End go to ¼/½.
 * @param props - The split-column, its current columns and the widget's name.
 * @returns The handle, plus the snap preview while dragging.
 */
export function SplitResizeHandle({
	splitId,
	columns,
	count,
	title,
}: SplitResizeHandleProps) {
	const { t } = useTranslation();
	const setSplitColumns = useEditor((state) => state.setSplitColumns);
	// While dragging: the snapped columns and the split-column's width in px.
	const [preview, setPreview] = useState<{
		columns: number;
		width: number;
	} | null>(null);

	const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		const item = event.currentTarget.parentElement;
		const grid = item?.closest("[data-drop-list]");
		if (!item || !grid) return;
		event.preventDefault();
		event.stopPropagation();
		const target = event.currentTarget;
		try {
			target.setPointerCapture(event.pointerId);
		} catch {
			// Unknown pointer (e.g. a synthetic event): resize without capture.
		}
		const direction = currentDirection();
		// Widths grow from the item's inline start, so measure from there.
		const itemStart = inlineStartX(item.getBoundingClientRect(), direction);
		const width = grid.getBoundingClientRect().width;
		let snapped = columns;
		setPreview({ columns, width });
		const move = (moveEvent: globalThis.PointerEvent) => {
			snapped = snapColumns(
				inlineDelta(moveEvent.clientX - itemStart, direction) / width,
			);
			setPreview({ columns: snapped, width });
		};
		const stop = () => {
			target.removeEventListener("pointermove", move);
			target.removeEventListener("pointerup", stop);
			target.removeEventListener("pointercancel", stop);
			setPreview(null);
			if (snapped !== columns) setSplitColumns(splitId, snapped);
		};
		target.addEventListener("pointermove", move);
		target.addEventListener("pointerup", stop);
		target.addEventListener("pointercancel", stop);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const next = stepColumns(
			columns,
			logicalKey(event.key, currentDirection()),
		);
		if (next === null) return;
		event.preventDefault();
		if (next !== columns) setSplitColumns(splitId, next);
	};

	return (
		<>
			{preview && (
				<div
					aria-hidden="true"
					style={{ width: preview.width / preview.columns }}
					className="pointer-events-none absolute inset-y-0 start-0 z-20 rounded-md border-2 border-dashed border-accent bg-accent/10"
				>
					<span className="absolute -top-7 start-0 rounded-[6px] bg-accent px-1.5 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap text-accent-ink">
						{widthLabel(preview.columns)}
					</span>
					<span className="absolute top-full start-0 mt-1 w-56 rounded-[6px] border border-line bg-card px-2 py-1 text-[11px] text-muted shadow-lg">
						{count > 1
							? t("canvas.split.sharedWidth", { count })
							: t("canvas.split.equalColumns")}
					</span>
				</div>
			)}
			<div
				role="slider"
				tabIndex={0}
				aria-label={t("canvas.split.widthOf", { name: title })}
				aria-valuemin={25}
				aria-valuemax={50}
				aria-valuenow={Math.round(100 / columns)}
				aria-valuetext={t("canvas.split.valueText", {
					fraction: fractionSymbol(columns),
					count: columns,
				})}
				title={t("canvas.split.handleTitle")}
				onPointerDown={onPointerDown}
				onKeyDown={onKeyDown}
				className="group absolute inset-y-1 -end-2 z-20 flex w-3 cursor-col-resize touch-none items-center justify-center focus-visible:outline-none"
			>
				<span className="h-8 w-1.5 rounded-full bg-accent shadow-[0_0_0_3px_var(--color-canvas)] group-focus-visible:h-12" />
			</div>
		</>
	);
}
