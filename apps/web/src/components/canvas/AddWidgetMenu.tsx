import type { WidgetList } from "../../lib/drop-target.ts";
import { newWidgetOf, widgetCatalog } from "../../lib/widget-catalog.ts";
import { useEditor } from "../../store/editor-store.ts";
import { PlusIcon } from "../ui/icons.tsx";
import { Menu } from "../ui/Menu.tsx";
import { useTranslation } from "react-i18next";

export interface AddWidgetMenuProps {
	/** The list the new widget is added to (at the end). */
	readonly list: WidgetList;
}

/**
 * "+ Widget": adds a widget at the end of a column or the head widgets, for
 * when dragging from the library isn't handy (keyboard, small screens). The
 * new widget starts with its schema's starting options and is selected.
 * @param props - The target list.
 * @returns The menu button.
 */
export function AddWidgetMenu({ list }: AddWidgetMenuProps) {
	const { t } = useTranslation();
	const addWidget = useEditor((state) => state.addWidget);
	// Head widgets stay one row: no split-columns there (Glaze's rule).
	const entries = widgetCatalog().filter(
		(entry) => !(list.kind === "head" && entry.type === "split-column"),
	);
	return (
		<Menu
			label={t("canvas.addWidget.label", { list: list.label })}
			trigger={
				<>
					<PlusIcon />
					{t("canvas.addWidget.trigger")}
				</>
			}
			triggerClassName="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-sm border border-dashed border-line-strong text-sm text-muted hover:border-accent hover:text-text"
			items={entries.map((entry) => ({
				label: entry.label,
				onSelect: () =>
					addWidget(newWidgetOf(entry.type), list.path, list.widgetIds.length),
			}))}
		/>
	);
}
