import type { WidgetNode } from "@glaze/core";
import type { WidgetList as WidgetListModel } from "../../lib/drop-target.ts";
import { WidgetList } from "./WidgetList.tsx";

export interface HeadWidgetsProps {
	readonly widgets: readonly WidgetNode[];
	/** The head widgets as a drop target. */
	readonly list: WidgetListModel;
}

/**
 * The page's `head-widgets`: a strip above the columns, as in Glance.
 * It is always there, also when empty, so the canvas never shifts while
 * dragging and widgets can be dropped into it.
 * @param props - The head widgets of the open page and their drop list.
 * @returns The strip.
 */
export function HeadWidgets({ widgets, list }: HeadWidgetsProps) {
	return (
		<section
			aria-label="Head widgets"
			className="mb-4 rounded-lg border border-dashed border-line-strong bg-bg/60 p-3"
		>
			<h2 className="mb-2 font-mono text-xs text-muted">
				head widgets
				{widgets.length === 0 && (
					<span className="text-faint">
						{" "}
						· drop a widget here to show it above all columns
					</span>
				)}
			</h2>
			<WidgetList list={list} widgets={widgets} layout="row" />
		</section>
	);
}
