import type { ColumnNode } from "@glaze/core";
import type { WidgetList as WidgetListModel } from "../../lib/drop-target.ts";
import { Button } from "../ui/Button.tsx";
import { ChevronDownIcon, PlusIcon } from "../ui/icons.tsx";
import { WidgetList } from "./WidgetList.tsx";

export interface ColumnCardProps {
	readonly column: ColumnNode;
	/** The column as a drop target. */
	readonly list: WidgetListModel;
}

/**
 * One column: a dashed card with its size label, widgets and "+ Widget".
 * `small` columns have a fixed width and `full` columns share the rest, like in Glance.
 * @param props - The column and its drop list.
 * @returns The section element.
 */
export function ColumnCard({ column, list }: ColumnCardProps) {
	const isFull = column.size === "full";
	return (
		<section
			aria-label={`${list.label}, ${column.size ?? "no size"}`}
			className={`flex flex-col gap-2 self-stretch rounded-lg border border-dashed border-line-strong bg-bg/60 p-3 ${
				isFull ? "min-w-[280px] flex-1" : "w-[240px] shrink-0"
			}`}
		>
			<header className="flex items-center justify-between px-1 pb-1">
				<h2 className="font-mono text-xs text-muted">{list.label}</h2>
				{/* Becomes a dropdown to switch small/full in step 2d. */}
				<span className="inline-flex items-center gap-1 rounded-[6px] border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
					{column.size ?? "?"}
					<ChevronDownIcon className="size-2.5" />
				</span>
			</header>
			<WidgetList
				list={list}
				widgets={column.widgets}
				layout="stack"
				footer={
					<Button
						variant="dashed"
						unavailable="Coming soon"
						className="min-h-10"
					>
						<PlusIcon />
						Widget
					</Button>
				}
			/>
		</section>
	);
}
