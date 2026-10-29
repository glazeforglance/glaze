import type { PageNode } from "@glaze/core";
import { useEditor } from "../../store/editor-store.ts";
import { Button } from "../ui/Button.tsx";
import { PlusIcon } from "../ui/icons.tsx";
import { useTranslation } from "react-i18next";

export interface PageHeaderProps {
	readonly page: PageNode;
}

/**
 * Page title with slug and column count, plus the page-level buttons.
 * @param props - The open page.
 * @returns The header row.
 */
export function PageHeader({ page }: PageHeaderProps) {
	const { t } = useTranslation();
	const count = page.columns.length;
	const addColumn = useEditor((state) => state.addColumn);
	const openPageSettings = useEditor((state) => state.openPageSettings);
	return (
		<div className="mb-6 flex flex-wrap items-center gap-3">
			<h1 className="text-2xl font-bold">
				<button
					type="button"
					onClick={openPageSettings}
					title={t("canvas.pageSettings")}
					dir="auto"
					className="cursor-pointer rounded-sm text-start hover:text-accent"
				>
					{page.name ?? t("page.untitled")}
				</button>
			</h1>
			<p className="font-mono text-xs text-muted">
				{page.slug && (
					<>
						<bdi dir="ltr">/{page.slug}</bdi> ·{" "}
					</>
				)}
				{t("canvas.columnCount", { count })}
				{page.width ? ` · ${page.width}` : ""}
			</p>
			<div className="ms-auto flex gap-2">
				{/* New columns are small; core refuses a 4th column (3rd on a slim page) with a notice. */}
				<Button onClick={() => addColumn("small")}>
					<PlusIcon />
					{t("canvas.addColumn")}
				</Button>
				<Button onClick={openPageSettings}>{t("canvas.pageSettings")}</Button>
			</div>
		</div>
	);
}
