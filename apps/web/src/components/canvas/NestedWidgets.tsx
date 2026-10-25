import type { WidgetNode } from "@glaze/core";
import { WidgetBlock } from "./WidgetBlock.tsx";

export interface NestedWidgetsProps {
	readonly parent: WidgetNode;
}

/**
 * The children of a `group` (stacked, one per tab) or a `split-column`
 * (side by side, as Glance shows them).
 * @param props - The group or split-column.
 * @returns The list of child blocks.
 */
export function NestedWidgets({ parent }: NestedWidgetsProps) {
	const sideBySide = parent.type === "split-column";
	return (
		<ul
			aria-label={`Widgets in ${parent.title ?? parent.type ?? "widget"}`}
			className={`gap-1.5 border-t border-line p-2 ${
				sideBySide
					? "grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))]"
					: "flex flex-col"
			}`}
		>
			{parent.children.map((child) => (
				<li key={child.id}>
					<WidgetBlock widget={child} nested />
				</li>
			))}
		</ul>
	);
}
