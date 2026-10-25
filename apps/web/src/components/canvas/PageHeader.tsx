import type { PageNode } from "@glaze/core";
import { useEditor } from "../../store/editor-store.ts";
import { Button } from "../ui/Button.tsx";
import { PlusIcon } from "../ui/icons.tsx";

export interface PageHeaderProps {
	readonly page: PageNode;
}

/**
 * Page title with slug and column count, plus the page-level buttons.
 * @param props - The open page.
 * @returns The header row.
 */
export function PageHeader({ page }: PageHeaderProps) {
	const count = page.columns.length;
	const addColumn = useEditor((state) => state.addColumn);
	return (
		<div className="mb-6 flex flex-wrap items-center gap-3">
			<h1 className="text-2xl font-bold">{page.name ?? "Untitled page"}</h1>
			<p className="font-mono text-xs text-muted">
				{page.slug ? `/${page.slug} · ` : ""}
				{count} {count === 1 ? "column" : "columns"}
				{page.width ? ` · ${page.width}` : ""}
			</p>
			<div className="ml-auto flex gap-2">
				{/* New columns are small; core refuses a 4th column (3rd on a slim page) with a notice. */}
				<Button onClick={() => addColumn("small")}>
					<PlusIcon />
					Add column
				</Button>
				<Button unavailable="Page settings arrive in phase 3">
					Page settings
				</Button>
			</div>
		</div>
	);
}
