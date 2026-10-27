import type { KeyboardEvent, PointerEvent } from "react";
import {
	clampSize,
	type ResizeBounds,
	sizeAfterKey,
} from "../../lib/resize.ts";

export interface ResizeHandleProps extends ResizeBounds {
	/** Current size, in the same unit as `min` and `max`. */
	readonly value: number;
	readonly onChange: (value: number) => void;
	/** Double-click puts the size back to its default. */
	readonly onReset?: () => void;
	/** Tells the parent a pointer drag started or ended (e.g. to block an iframe). */
	readonly onDragChange?: (dragging: boolean) => void;
	/** How much an arrow key changes the size. */
	readonly step: number;
	/** `1` when dragging right makes the area bigger, `-1` when it makes it smaller. */
	readonly direction: 1 | -1;
	/**
	 * Turns a pointer movement into a size, e.g. `start + dx` for pixels or
	 * `start + dx / container.width` for a ratio.
	 */
	readonly fromPointer: (
		start: number,
		deltaX: number,
		container: DOMRect,
	) => number;
	/** Turns the size into the number screen readers hear (e.g. a ratio into %). */
	readonly ariaValue?: (value: number) => number;
	/** Name read by screen readers, e.g. "Resize widget library". */
	readonly label: string;
	/** Id of the area this handle resizes. */
	readonly controls: string;
	readonly className?: string;
}

/**
 * A vertical bar that resizes the area next to it. Drag it with the pointer,
 * or focus it and use the arrow keys, Home and End (WAI-ARIA window splitter
 * pattern). Double-click resets the size.
 * @param props - Size, limits, how pointer movement maps to a size, and handlers.
 * @returns The separator element.
 */
export function ResizeHandle({
	value,
	min,
	max,
	onChange,
	onReset,
	onDragChange,
	step,
	direction,
	fromPointer,
	ariaValue = Math.round,
	label,
	controls,
	className = "",
}: ResizeHandleProps) {
	const bounds = { min, max };

	const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		const container = event.currentTarget.parentElement;
		if (!container) return;
		event.preventDefault();
		const target = event.currentTarget;
		try {
			// Keeps the drag going when the pointer leaves the thin handle.
			target.setPointerCapture(event.pointerId);
		} catch {
			// Unknown pointer (e.g. a synthetic event): resize without capture.
		}
		onDragChange?.(true);
		const rect = container.getBoundingClientRect();
		const startX = event.clientX;
		const start = value;
		const move = (moveEvent: globalThis.PointerEvent) =>
			onChange(
				clampSize(fromPointer(start, moveEvent.clientX - startX, rect), bounds),
			);
		const stop = () => {
			target.removeEventListener("pointermove", move);
			target.removeEventListener("pointerup", stop);
			target.removeEventListener("pointercancel", stop);
			onDragChange?.(false);
		};
		target.addEventListener("pointermove", move);
		target.addEventListener("pointerup", stop);
		target.addEventListener("pointercancel", stop);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const next = sizeAfterKey(event.key, value, bounds, step, direction);
		if (next === null) return;
		event.preventDefault();
		onChange(next);
	};

	return (
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label={label}
			aria-controls={controls}
			aria-valuemin={ariaValue(min)}
			aria-valuemax={ariaValue(max)}
			aria-valuenow={ariaValue(value)}
			tabIndex={0}
			onPointerDown={onPointerDown}
			onKeyDown={onKeyDown}
			onDoubleClick={onReset}
			title={onReset ? "Drag to resize · double-click to reset" : undefined}
			className={`group z-20 w-px shrink-0 cursor-col-resize touch-none bg-line focus-visible:outline-none ${className}`}
		>
			{/* A wider invisible hit area, and a visible bar on hover or focus. */}
			<span className="absolute inset-y-0 -left-1.5 w-3" />
			<span className="absolute inset-y-0 -left-px w-[3px] bg-accent opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-100" />
		</div>
	);
}
