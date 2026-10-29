import type { ColumnNode } from "@glaze/core";
import type { WidgetList as WidgetListModel } from "../../lib/drop-target.ts";
import { AddWidgetMenu } from "./AddWidgetMenu.tsx";
import { ColumnSizeMenu } from "./ColumnSizeMenu.tsx";
import { WidgetList } from "./WidgetList.tsx";
import { useTranslation } from "react-i18next";

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
	const { t } = useTranslation();
	const isFull = column.size === "full";
	return (
		<section
			aria-label={t("canvas.column.label", {
				column: list.label,
				size: column.size ?? t("canvas.column.noSize"),
			})}
			className={`flex flex-col gap-2 self-stretch rounded-lg border border-dashed border-line-strong bg-bg/60 p-3 ${
				isFull ? "min-w-[280px] flex-1" : "w-[240px] shrink-0"
			}`}
		>
			<header className="flex items-center justify-between px-1 pb-1">
				<h2 className="font-mono text-xs text-muted">{list.label}</h2>
				<ColumnSizeMenu column={column} label={list.label} />
			</header>
			<WidgetList
				list={list}
				widgets={column.widgets}
				layout="stack"
				footer={<AddWidgetMenu list={list} />}
			/>
		</section>
	);
}
