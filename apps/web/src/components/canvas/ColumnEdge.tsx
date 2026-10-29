import type { KeyboardEvent, PointerEvent } from "react";
import { useState } from "react";
import {
	type ColumnEdgeResult,
	columnEdgeChange,
} from "../../lib/column-edge.ts";
import { useEditor } from "../../store/editor-store.ts";
import { useTranslation } from "react-i18next";
import { currentDirection } from "../../i18n.ts";
import { inlineDelta, logicalKey } from "../../lib/direction.ts";

export interface ColumnEdgeProps {
	/** Ids of the page's columns, in order. */
	readonly columnIds: readonly string[];
	/** Their sizes, in the same order. */
	readonly sizes: readonly (string | null)[];
	/** Index of the column before this edge (left of it in LTR). */
	readonly edge: number;
}

/** How far (px) the edge must be dragged before it means something. */
const THRESHOLD_PX = 24;

/**
 * The gap between two page columns, as a handle: dragging it towards the
 * end of the line (right in LTR, left in RTL) makes the column before it
 * `full` (or the one after it `small`), dragging back does the opposite. Glance only knows these two sizes, and a page needs 1 or 2
 * full columns, so while dragging a label says what will happen, or why
 * nothing can. Arrow keys do the same when the handle has focus.
 * @param props - The page's columns and which edge this is.
 * @returns The handle.
 */
export function ColumnEdge({ columnIds, sizes, edge }: ColumnEdgeProps) {
	const { t } = useTranslation();
	const setColumnSize = useEditor((state) => state.setColumnSize);
	const showNotice = useEditor((state) => state.showNotice);
	const [plan, setPlan] = useState<ColumnEdgeResult | null>(null);

	const apply = (result: ColumnEdgeResult) => {
		if (result.kind === "blocked") {
			showNotice(result.reason);
			return;
		}
		const id = columnIds[result.index];
		if (id !== undefined) setColumnSize(id, result.size);
	};

	const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
		if (event.button !== 0) return;
		const target = event.currentTarget;
		try {
			target.setPointerCapture(event.pointerId);
		} catch {
			// Unknown pointer (e.g. a synthetic event): track without capture.
		}
		const startX = event.clientX;
		const direction = currentDirection();
		let result: ColumnEdgeResult | null = null;
		const move = (moveEvent: globalThis.PointerEvent) => {
			const dx = inlineDelta(moveEvent.clientX - startX, direction);
			result =
				Math.abs(dx) < THRESHOLD_PX
					? null
					: columnEdgeChange(sizes, edge, dx > 0 ? 1 : -1);
			setPlan(result);
		};
		const stop = () => {
			target.removeEventListener("pointermove", move);
			target.removeEventListener("pointerup", stop);
			target.removeEventListener("pointercancel", stop);
			setPlan(null);
			if (result) apply(result);
		};
		target.addEventListener("pointermove", move);
		target.addEventListener("pointerup", stop);
		target.addEventListener("pointercancel", stop);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		const key = logicalKey(event.key, currentDirection());
		if (key !== "ArrowLeft" && key !== "ArrowRight") return;
		event.preventDefault();
		apply(columnEdgeChange(sizes, edge, key === "ArrowRight" ? 1 : -1));
	};

	const label =
		plan === null
			? null
			: plan.kind === "blocked"
				? plan.reason
				: t("canvas.columnEdge.plan", {
						number: plan.index + 1,
						size: plan.size,
					});

	return (
		<div className="relative flex w-4 shrink-0 self-stretch justify-center">
			<button
				type="button"
				aria-label={t("canvas.columnEdge.label", {
					left: edge + 1,
					right: edge + 2,
				})}
				aria-keyshortcuts="ArrowLeft ArrowRight"
				title={t("canvas.columnEdge.title")}
				onPointerDown={onPointerDown}
				onKeyDown={onKeyDown}
				className="group flex w-full cursor-col-resize touch-none justify-center focus-visible:outline-none"
			>
				<span className="w-px bg-transparent transition-colors group-hover:bg-accent/60 group-focus-visible:w-[3px] group-focus-visible:bg-accent" />
			</button>
			{label !== null && (
				<span
					role="status"
					className={`pointer-events-none absolute top-10 z-30 w-max max-w-56 rounded-[6px] px-2 py-1 text-xs font-semibold shadow-lg ${
						plan?.kind === "blocked"
							? "border border-danger/50 bg-card text-danger"
							: "bg-accent text-accent-ink"
					}`}
				>
					{label}
				</span>
			)}
		</div>
	);
}
