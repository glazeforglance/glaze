import type { ReactNode } from "react";
import { type PanelConfig, usePanel } from "../../hooks/use-panel.ts";
import { PanelIcon } from "../ui/icons.tsx";
import { ResizeHandle } from "../ui/ResizeHandle.tsx";

export interface SidePanelProps extends PanelConfig {
	/** Storage name and DOM id, e.g. `library`. */
	readonly id: string;
	/** Which side of the canvas it is on; the handle goes on the inner edge. */
	readonly side: "left" | "right";
	/** Short name for buttons and screen readers, e.g. "widget library". */
	readonly label: string;
	readonly children: ReactNode;
}

const KEY_STEP_PX = 16;

const TOGGLE_CLASS =
	"inline-flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-faint hover:bg-card hover:text-text";

/**
 * A resizable, collapsible side panel. The width can be dragged on the inner
 * edge (or set with the keyboard), double-clicking the edge resets it, and
 * both the width and the collapsed state are remembered per browser.
 * Collapsed, it shrinks to a thin strip with a button to open it again, so the
 * canvas gets the full width on small screens.
 * @param props - Id, side, size limits and the panel's content.
 * @returns The panel.
 */
export function SidePanel({
	id,
	side,
	label,
	children,
	...config
}: SidePanelProps) {
	const panel = usePanel(id, config);
	const contentId = `${id}-panel`;

	if (panel.collapsed) {
		return (
			<div
				className={`flex w-9 shrink-0 flex-col items-center bg-bg py-3 ${
					side === "left" ? "border-r" : "border-l"
				} border-line`}
			>
				<button
					type="button"
					aria-label={`Show the ${label}`}
					aria-expanded={false}
					aria-controls={contentId}
					title={`Show the ${label}`}
					onClick={() => panel.setCollapsed(false)}
					className={TOGGLE_CLASS}
				>
					<PanelIcon side={side} />
				</button>
				<span className="mt-3 font-mono text-[11px] tracking-wider text-faint uppercase [writing-mode:vertical-rl]">
					{label}
				</span>
			</div>
		);
	}

	return (
		<div
			id={contentId}
			style={{ width: panel.width }}
			className="relative flex min-h-0 shrink-0"
		>
			{children}
			<button
				type="button"
				aria-label={`Hide the ${label}`}
				aria-expanded={true}
				aria-controls={contentId}
				title={`Hide the ${label}`}
				onClick={() => panel.setCollapsed(true)}
				className={`${TOGGLE_CLASS} absolute bottom-3 z-10 border border-line bg-bg ${
					side === "left" ? "right-3" : "left-3"
				}`}
			>
				<PanelIcon side={side} />
			</button>
			<ResizeHandle
				value={panel.width}
				min={panel.min}
				max={panel.max}
				step={KEY_STEP_PX}
				direction={side === "left" ? 1 : -1}
				fromPointer={(start, deltaX) =>
					side === "left" ? start + deltaX : start - deltaX
				}
				onChange={panel.setWidth}
				onReset={panel.resetWidth}
				label={`Resize the ${label}`}
				controls={contentId}
				className={`absolute inset-y-0 ${side === "left" ? "right-0" : "left-0"}`}
			/>
		</div>
	);
}
