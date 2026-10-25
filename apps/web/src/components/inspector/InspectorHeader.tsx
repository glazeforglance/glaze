import type { WidgetNode } from "@glaze/core";
import { widgetDisplay } from "../../lib/model.ts";
import { Badge } from "../ui/Badge.tsx";

export interface InspectorHeaderProps {
	readonly widget: WidgetNode;
}

/**
 * Badge, title and `type: …` of the selected widget.
 * @param props - The selected widget.
 * @returns The header element.
 */
export function InspectorHeader({ widget }: InspectorHeaderProps) {
	const { title, abbr, tone } = widgetDisplay(widget);
	return (
		<header className="mb-4 flex items-center gap-3">
			<Badge text={abbr} tone={tone} />
			<div className="min-w-0">
				<h2 className="truncate text-lg font-bold">{title}</h2>
				<p className="truncate font-mono text-xs text-muted">
					{widget.include !== null
						? `$include: ${widget.include}`
						: `type: ${widget.type ?? "?"}`}
				</p>
			</div>
		</header>
	);
}
