import type { KeyboardEvent, PointerEvent } from "react";

export interface SplitHandleProps {
	/** Share of the width for the left pane, 0–1. */
	readonly ratio: number;
	readonly onChange: (ratio: number) => void;
	readonly onDragChange: (dragging: boolean) => void;
	readonly min?: number;
	readonly max?: number;
	/** Id of the pane this handle resizes. */
	readonly controls: string;
}

const KEY_STEP = 0.05;

/**
 * The vertical bar between code and preview. Drag it with the mouse, or focus
 * it and use the arrow keys (WAI-ARIA window splitter pattern).
 * @param props - Current ratio, limits and change handlers.
 * @returns The separator element.
 */
export function SplitHandle({
	ratio,
	onChange,
	onDragChange,
	min = 0.25,
	max = 0.8,
	controls,
}: SplitHandleProps) {
	const clamp = (value: number) => Math.min(max, Math.max(min, value));

	const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		const container = event.currentTarget.parentElement;
		if (!container) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		onDragChange(true);
		const rect = container.getBoundingClientRect();
		const move = (moveEvent: globalThis.PointerEvent) =>
			onChange(clamp((moveEvent.clientX - rect.left) / rect.width));
		const target = event.currentTarget;
		const stop = () => {
			target.removeEventListener("pointermove", move);
			target.removeEventListener("pointerup", stop);
			target.removeEventListener("pointercancel", stop);
			onDragChange(false);
		};
		target.addEventListener("pointermove", move);
		target.addEventListener("pointerup", stop);
		target.addEventListener("pointercancel", stop);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const next =
			event.key === "ArrowLeft"
				? ratio - KEY_STEP
				: event.key === "ArrowRight"
					? ratio + KEY_STEP
					: event.key === "Home"
						? min
						: event.key === "End"
							? max
							: null;
		if (next === null) return;
		event.preventDefault();
		onChange(clamp(next));
	};

	return (
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize code and preview"
			aria-controls={controls}
			aria-valuemin={Math.round(min * 100)}
			aria-valuemax={Math.round(max * 100)}
			aria-valuenow={Math.round(ratio * 100)}
			tabIndex={0}
			onPointerDown={onPointerDown}
			onKeyDown={onKeyDown}
			className="group relative w-px shrink-0 cursor-col-resize bg-line focus-visible:outline-none"
		>
			{/* A wider invisible hit area, and a visible bar on hover or focus. */}
			<span className="absolute inset-y-0 -left-1.5 w-3" />
			<span className="absolute inset-y-0 -left-px w-[3px] bg-accent opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-100" />
		</div>
	);
}
