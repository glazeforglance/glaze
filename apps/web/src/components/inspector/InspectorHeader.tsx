import type { WidgetNode } from "@glaze/core";
import { badgeToneFor, catalogEntry } from "../../lib/widget-catalog.ts";
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
	const entry = catalogEntry(widget.type);
	const isInclude = widget.include !== null;
	return (
		<header className="mb-4 flex items-center gap-3">
			<Badge
				text={isInclude ? "IN" : entry.abbr}
				tone={badgeToneFor(widget.type)}
			/>
			<div className="min-w-0">
				<h2 className="truncate text-lg font-bold">
					{isInclude ? "Include" : (widget.title ?? entry.label)}
				</h2>
				<p className="truncate font-mono text-xs text-muted">
					{isInclude
						? `$include: ${widget.include}`
						: `type: ${widget.type ?? "?"}`}
				</p>
			</div>
		</header>
	);
}
