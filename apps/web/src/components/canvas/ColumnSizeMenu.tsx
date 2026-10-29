import type { ColumnNode } from "@glaze/core";
import { useState } from "react";
import { useEditor } from "../../store/editor-store.ts";
import { ConfirmDialog } from "../ui/ConfirmDialog.tsx";
import { ChevronDownIcon } from "../ui/icons.tsx";
import { Menu } from "../ui/Menu.tsx";
import { useTranslation } from "react-i18next";

export interface ColumnSizeMenuProps {
	readonly column: ColumnNode;
	/** "column 2", for labels. */
	readonly label: string;
}

/**
 * The `small ▾` / `full ▾` label of a column: switch the size, or remove the
 * column (asking first when it still has widgets). Refused changes, like a
 * third full column, show the core's message as a notice.
 * @param props - The column and its label.
 * @returns The menu button and its confirmation dialog.
 */
export function ColumnSizeMenu({ column, label }: ColumnSizeMenuProps) {
	const { t } = useTranslation();
	const [confirming, setConfirming] = useState(false);
	const setColumnSize = useEditor((state) => state.setColumnSize);
	const removeColumn = useEditor((state) => state.removeColumn);
	const count = column.widgets.length;

	return (
		<>
			<Menu
				label={t("canvas.columnSize.label", {
					column: label,
					size: column.size ?? t("canvas.column.noSize"),
				})}
				align="end"
				trigger={
					<>
						{column.size ?? "?"}
						<ChevronDownIcon className="size-2.5" />
					</>
				}
				triggerClassName="inline-flex min-h-7 items-center gap-1 rounded-[6px] border border-line px-2 font-mono text-[11px] text-muted hover:border-line-strong hover:text-text"
				items={[
					{
						label: "small",
						checked: column.size === "small",
						onSelect: () => setColumnSize(column.id, "small"),
					},
					{
						label: "full",
						checked: column.size === "full",
						onSelect: () => setColumnSize(column.id, "full"),
					},
					{
						label: t("canvas.columnSize.remove"),
						danger: true,
						onSelect: () =>
							count === 0 ? removeColumn(column.id) : setConfirming(true),
					},
				]}
			/>
			<ConfirmDialog
				open={confirming}
				title={t("canvas.columnSize.removeTitle", { column: label })}
				confirmLabel={t("canvas.columnSize.removeConfirm")}
				onCancel={() => setConfirming(false)}
				onConfirm={() => {
					setConfirming(false);
					removeColumn(column.id);
				}}
			>
				{t("canvas.columnSize.removeBody", { count })}
			</ConfirmDialog>
		</>
	);
}
