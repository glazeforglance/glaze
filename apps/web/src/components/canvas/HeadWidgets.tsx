import type { WidgetNode } from "@glaze/core";
import type { WidgetList as WidgetListModel } from "../../lib/drop-target.ts";
import { AddWidgetMenu } from "./AddWidgetMenu.tsx";
import { WidgetList } from "./WidgetList.tsx";
import { useTranslation } from "react-i18next";

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
	const { t } = useTranslation();
	return (
		<section
			aria-label={t("canvas.head.label")}
			className="mb-4 rounded-lg border border-dashed border-line-strong bg-bg/60 p-3"
		>
			<h2 className="mb-2 font-mono text-xs text-muted">
				{t("dnd.list.head")}
				{widgets.length === 0 && (
					<span className="text-faint"> · {t("canvas.head.empty")}</span>
				)}
			</h2>
			<WidgetList
				list={list}
				widgets={widgets}
				layout="row"
				footer={
					<div className="mt-1 w-40">
						<AddWidgetMenu list={list} />
					</div>
				}
			/>
		</section>
	);
}
