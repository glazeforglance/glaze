import { useDraggable } from "@dnd-kit/core";
import type { WidgetNode } from "@glaze/core";
import { useState } from "react";
import { dropItemProps, dropListProps } from "../../lib/dnd-measure.ts";
import { containerList } from "../../lib/drop-target.ts";
import { widgetDisplay } from "../../lib/model.ts";
import { fractionSymbol } from "../../lib/widget-width.ts";
import { useEditor } from "../../store/editor-store.ts";
import { DropIndicator } from "../dnd/DropIndicator.tsx";
import { type DragData, useDragState } from "../dnd/drag-state.ts";
import { ListKindContext, useListKind } from "./list-context.ts";
import { SplitResizeHandle } from "./SplitResizeHandle.tsx";
import { WidgetBlock } from "./WidgetBlock.tsx";
import { WidgetList } from "./WidgetList.tsx";
import { useTranslation } from "react-i18next";

export interface NestedWidgetsProps {
	readonly parent: WidgetNode;
}

/**
 * The children of a `split-column` (side by side, in `max-columns` columns)
 * or a `group` (as tabs). In a column they are a drop list of their own, so
 * widgets can be dragged in and out; in head widgets they are only shown.
 * @param props - The group or split-column.
 * @returns The children.
 */
export function NestedWidgets({ parent }: NestedWidgetsProps) {
	const kind = useListKind();
	// The list id only has to match `listsOfPage`; owners and label don't matter here.
	const list = containerList(parent, [], "");
	const droppable =
		list !== null && kind !== "head" && kind !== "group" && kind !== null;
	if (parent.type === "split-column") {
		return <SplitColumnBody parent={parent} droppable={droppable} />;
	}
	return <GroupTabs parent={parent} droppable={droppable} />;
}

function SplitColumnBody({
	parent,
	droppable,
}: NestedWidgetsProps & { readonly droppable: boolean }) {
	const { t } = useTranslation();
	const selectedId = useEditor((state) => state.selectedWidgetId);
	const columns = parent.maxColumns ?? 2;
	const list = containerList(parent, [], "");
	const count = parent.children.length;

	return (
		<div className="border-t border-line p-2">
			<p className="mb-1.5 flex flex-wrap items-center gap-x-2 px-0.5 font-mono text-[10px] text-faint">
				<span className="text-muted">
					{t("canvas.split.columns", {
						count: columns,
						fraction: fractionSymbol(columns),
					})}
				</span>
				<span title={t("canvas.split.approximateTitle")}>
					{t("canvas.split.approximate")}
				</span>
			</p>
			{droppable && list ? (
				<WidgetList
					list={list}
					widgets={parent.children}
					layout="grid"
					columns={columns}
					itemOverlay={(child) =>
						child.id === selectedId ? (
							<SplitResizeHandle
								splitId={parent.id}
								columns={columns}
								count={count}
								title={widgetDisplay(child).title}
							/>
						) : null
					}
				/>
			) : (
				<ul
					className="grid gap-1.5"
					style={{
						gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
					}}
				>
					{parent.children.map((child) => (
						<li key={child.id} className="min-w-0">
							<WidgetBlock widget={child} nested />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function GroupTabs({
	parent,
	droppable,
}: NestedWidgetsProps & { readonly droppable: boolean }) {
	const { t } = useTranslation();
	const selectedId = useEditor((state) => state.selectedWidgetId);
	const { active, indicator } = useDragState();
	const list = containerList(parent, [], "");
	const [chosen, setChosen] = useState<string | null>(null);
	// The selected child's tab is open; otherwise the last clicked one, else the first.
	const open =
		parent.children.find((child) => child.id === selectedId) ??
		parent.children.find((child) => child.id === chosen) ??
		parent.children[0] ??
		null;
	const shown =
		droppable && active && list && indicator?.listId === list.id
			? indicator
			: null;

	return (
		<div className="border-t border-line p-2">
			<ListKindContext value="group">
				<div
					{...(droppable && list ? dropListProps(list.id, "row") : {})}
					className="relative min-h-9"
				>
					<div
						role="tablist"
						aria-label={t("canvas.group.tabsOf", {
							name: parent.title ?? t("canvas.group.fallbackName"),
						})}
						className="flex flex-wrap gap-1"
					>
						{parent.children.map((child) => (
							<GroupTab
								key={child.id}
								child={child}
								listId={droppable && list ? list.id : null}
								open={child.id === open?.id}
								onOpen={() => setChosen(child.id)}
							/>
						))}
						{parent.children.length === 0 && (
							<span className="px-1 py-2 text-xs text-faint">
								{t("canvas.group.empty")}
							</span>
						)}
					</div>
					{active && shown && <DropIndicator drag={active} indicator={shown} />}
				</div>
				{open && (
					<div role="tabpanel" className="mt-1.5">
						<WidgetBlock widget={open} nested />
					</div>
				)}
			</ListKindContext>
		</div>
	);
}

function GroupTab({
	child,
	listId,
	open,
	onOpen,
}: {
	readonly child: WidgetNode;
	/** The group's drop list, or `null` when the tabs can't be dragged. */
	readonly listId: string | null;
	readonly open: boolean;
	readonly onOpen: () => void;
}) {
	const { t } = useTranslation();
	const { title, abbr, tone } = widgetDisplay(child);
	const data: DragData = {
		kind: "widget",
		widgetId: child.id,
		widgetType: child.type,
		label: title,
		abbr,
		tone,
	};
	const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
		id: child.id,
		data,
		disabled: listId === null,
	});
	return (
		<button
			type="button"
			ref={setNodeRef}
			{...(listId ? dropItemProps(listId) : {})}
			{...attributes}
			{...listeners}
			// After dnd-kit's attributes, which would make this a "button": it is a tab.
			role="tab"
			aria-selected={open}
			aria-roledescription={t("canvas.group.tabRole")}
			dir="auto"
			onClick={onOpen}
			className={`min-h-8 max-w-40 cursor-pointer truncate rounded-[6px] px-2.5 text-xs font-semibold ${
				open
					? "bg-card-hover text-text shadow-[inset_0_-2px_0_var(--color-accent)]"
					: "text-muted hover:bg-card hover:text-text"
			} ${isDragging ? "opacity-40" : ""}`}
		>
			{title}
		</button>
	);
}
