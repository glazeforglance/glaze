import type { ReactNode } from "react";
import { type PanelConfig, usePanel } from "../../hooks/use-panel.ts";
import { PanelIcon } from "../ui/icons.tsx";
import { ResizeHandle } from "../ui/ResizeHandle.tsx";
import { useTranslation } from "react-i18next";

export interface SidePanelProps extends PanelConfig {
	/** Storage name and DOM id, e.g. `library`. */
	readonly id: string;
	/**
	 * Which side of the canvas it is on, in reading order (`start` is the left
	 * in LTR and the right in RTL); the handle goes on the inner edge.
	 */
	readonly side: "start" | "end";
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
	const { t } = useTranslation();
	const panel = usePanel(id, config);
	const contentId = `${id}-panel`;

	if (panel.collapsed) {
		return (
			<div
				className={`flex w-9 shrink-0 flex-col items-center bg-bg py-3 ${
					side === "start" ? "border-e" : "border-s"
				} border-line`}
			>
				<button
					type="button"
					aria-label={t("panel.show", { panel: label })}
					aria-expanded={false}
					aria-controls={contentId}
					title={t("panel.show", { panel: label })}
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
				aria-label={t("panel.hide", { panel: label })}
				aria-expanded={true}
				aria-controls={contentId}
				title={t("panel.hide", { panel: label })}
				onClick={() => panel.setCollapsed(true)}
				// On the panel's edge, half over the canvas, so it never covers the panel's content.
				className={`${TOGGLE_CLASS} absolute top-2 z-30 border border-line bg-bg ${
					side === "start" ? "-end-3.5" : "-start-3.5"
				}`}
			>
				<PanelIcon side={side} />
			</button>
			<ResizeHandle
				value={panel.width}
				min={panel.min}
				max={panel.max}
				step={KEY_STEP_PX}
				direction={side === "start" ? 1 : -1}
				fromPointer={(start, deltaX) =>
					side === "start" ? start + deltaX : start - deltaX
				}
				onChange={panel.setWidth}
				onReset={panel.resetWidth}
				label={t("panel.resize", { panel: label })}
				controls={contentId}
				className={`absolute inset-y-0 ${side === "start" ? "end-0" : "start-0"}`}
			/>
		</div>
	);
}
