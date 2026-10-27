import type { ActiveDrag, DragIndicator } from "./drag-state.ts";

export interface DropIndicatorProps {
	readonly drag: ActiveDrag;
	readonly indicator: DragIndicator;
}

/**
 * Shows where the dragged widget will land: an amber line in the gap between
 * two widgets, or a dashed box over an empty list. It is absolutely
 * positioned inside its list, so it never pushes widgets around (that would
 * move the drop areas under the pointer and make the target flicker).
 * Hidden from screen readers: dnd-kit announces the position instead.
 * @param props - What is being dragged, and where to draw.
 * @returns The indicator.
 */
export function DropIndicator({ drag, indicator }: DropIndicatorProps) {
	const verb = drag.kind === "library" ? "add" : "move";
	const { kind, x, y, width, height } = indicator;

	if (kind === "box") {
		return (
			<div
				aria-hidden="true"
				style={{ left: x, top: y, width, height }}
				className="pointer-events-none absolute z-10 flex items-center justify-center rounded-md border-2 border-dashed border-accent bg-accent/10 px-3 text-center text-sm text-accent"
			>
				Drop to {verb} “{drag.label}”
			</div>
		);
	}
	if (kind === "beside") {
		// A thick bar on the target's edge, with the label on the inside.
		const left = indicator.side === "left";
		return (
			<div
				aria-hidden="true"
				style={{ left: x - 2, top: y, width: 4, height }}
				className="pointer-events-none absolute z-10 rounded-full bg-accent shadow-[0_0_0_4px_rgb(245_181_74/0.2)]"
			>
				<span
					className={`absolute top-1.5 rounded-[6px] bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold whitespace-nowrap text-accent-ink ${
						left ? "left-2" : "right-2"
					}`}
				>
					side by side
				</span>
			</div>
		);
	}
	const horizontal = kind === "horizontal";
	return (
		<div
			aria-hidden="true"
			style={
				horizontal
					? { left: x, top: y - 1.5, width, height: 3 }
					: { left: x - 1.5, top: y, width: 3, height }
			}
			className="pointer-events-none absolute z-10 rounded-full bg-accent shadow-[0_0_0_3px_rgb(245_181_74/0.18)]"
		>
			{horizontal && (
				<span className="absolute top-1/2 left-2 -translate-y-1/2 truncate rounded-[6px] bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold whitespace-nowrap text-accent-ink">
					{verb} “{drag.label}”
				</span>
			)}
		</div>
	);
}
