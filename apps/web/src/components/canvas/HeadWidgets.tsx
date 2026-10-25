import type { WidgetNode } from "@glaze/core";
import { WidgetBlock } from "./WidgetBlock.tsx";

export interface HeadWidgetsProps {
	readonly widgets: readonly WidgetNode[];
}

/**
 * The page's `head-widgets`: shown in a strip above the columns, as in Glance.
 * @param props - The head widgets of the open page.
 * @returns The strip, or nothing when the page has no head widgets.
 */
export function HeadWidgets({ widgets }: HeadWidgetsProps) {
	if (widgets.length === 0) return null;
	return (
		<section
			aria-label="Head widgets"
			className="mb-4 rounded-lg border border-dashed border-line-strong bg-bg/60 p-3"
		>
			<h2 className="mb-2 font-mono text-xs text-muted">head widgets</h2>
			<ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
				{widgets.map((widget) => (
					<li key={widget.id}>
						<WidgetBlock widget={widget} />
					</li>
				))}
			</ul>
		</section>
	);
}
