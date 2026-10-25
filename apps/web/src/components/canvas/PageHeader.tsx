import type { PageNode } from "@glaze/core";
import { Button } from "../ui/Button.tsx";

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
	return (
		<div className="mb-6 flex flex-wrap items-center gap-3">
			<h1 className="text-2xl font-bold">{page.name ?? "Untitled page"}</h1>
			<p className="font-mono text-xs text-muted">
				{page.slug ? `/${page.slug} · ` : ""}
				{count} {count === 1 ? "column" : "columns"}
				{page.width ? ` · ${page.width}` : ""}
			</p>
			<div className="ml-auto flex gap-2">
				<Button unavailable="Coming soon">Add column</Button>
				<Button unavailable="Coming soon">Page settings</Button>
			</div>
		</div>
	);
}
