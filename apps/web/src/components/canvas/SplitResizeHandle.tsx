import type { KeyboardEvent, PointerEvent } from "react";
import { useState } from "react";
import {
	fractionSymbol,
	snapColumns,
	stepColumns,
	widthLabel,
} from "../../lib/widget-width.ts";
import { useEditor } from "../../store/editor-store.ts";

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
 * The handle on the right edge of a selected widget in a split-column.
 * Dragging it snaps the width to ½, ⅓ or ¼ of the split-column, which sets
 * the split-column's `max-columns` (2, 3 or 4) on release. Glance gives every
 * widget in a split-column the same width, so a notice says so while dragging.
 * Keyboard: Left/Right make it narrower/wider, Home/End go to ¼/½.
 * @param props - The split-column, its current columns and the widget's name.
 * @returns The handle, plus the snap preview while dragging.
 */
export function SplitResizeHandle({
	splitId,
	columns,
	count,
	title,
}: SplitResizeHandleProps) {
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
		const itemLeft = item.getBoundingClientRect().left;
		const width = grid.getBoundingClientRect().width;
		let snapped = columns;
		setPreview({ columns, width });
		const move = (moveEvent: globalThis.PointerEvent) => {
			snapped = snapColumns((moveEvent.clientX - itemLeft) / width);
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
		const next = stepColumns(columns, event.key);
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
					className="pointer-events-none absolute inset-y-0 left-0 z-20 rounded-md border-2 border-dashed border-accent bg-accent/10"
				>
					<span className="absolute -top-7 left-0 rounded-[6px] bg-accent px-1.5 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap text-accent-ink">
						{widthLabel(preview.columns)}
					</span>
					<span className="absolute top-full left-0 mt-1 w-56 rounded-[6px] border border-line bg-card px-2 py-1 text-[11px] text-muted shadow-lg">
						{count > 1
							? `All ${count} widgets in this split-column get this width (Glance draws equal columns).`
							: "Glance draws equal columns, so the rest of the row stays empty."}
					</span>
				</div>
			)}
			<div
				role="slider"
				tabIndex={0}
				aria-label={`Width of ${title}`}
				aria-valuemin={25}
				aria-valuemax={50}
				aria-valuenow={Math.round(100 / columns)}
				aria-valuetext={`${fractionSymbol(columns)} of the split-column, ${columns} columns, shared by all its widgets`}
				title="Drag to resize: ½, ⅓ or ¼ (all widgets in this split-column)"
				onPointerDown={onPointerDown}
				onKeyDown={onKeyDown}
				className="group absolute inset-y-1 -right-2 z-20 flex w-3 cursor-col-resize touch-none items-center justify-center focus-visible:outline-none"
			>
				<span className="h-8 w-1.5 rounded-full bg-accent shadow-[0_0_0_3px_var(--color-canvas)] group-focus-visible:h-12" />
			</div>
		</>
	);
}
