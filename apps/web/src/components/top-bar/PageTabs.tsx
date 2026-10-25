import { useEditor } from "../../store/editor-store.ts";
import { Button } from "../ui/Button.tsx";
import { PlusIcon } from "../ui/icons.tsx";

/**
 * One tab per page, plus "+ Page".
 * @returns The tab list.
 */
export function PageTabs() {
	const pages = useEditor((state) => state.pages);
	const selectedPageId = useEditor((state) => state.selectedPageId);
	const selectPage = useEditor((state) => state.selectPage);

	return (
		<div className="flex min-w-0 items-center gap-1 overflow-x-auto">
			<div
				role="tablist"
				aria-label="Pages"
				className="flex items-center gap-1"
			>
				{pages.map((page, index) => {
					const selected = page.id === selectedPageId;
					return (
						<button
							key={page.id}
							type="button"
							role="tab"
							aria-selected={selected}
							onClick={() => selectPage(page.id)}
							className={`min-h-9 cursor-pointer rounded-sm px-3.5 text-sm whitespace-nowrap transition-colors ${
								selected
									? "bg-card font-semibold text-text"
									: "text-muted hover:bg-card hover:text-text"
							}`}
						>
							{page.name ??
								(page.include ? `Include ${index + 1}` : `Page ${index + 1}`)}
						</button>
					);
				})}
			</div>
			<Button unavailable="Coming soon" className="ml-1 border-dashed">
				<PlusIcon />
				Page
			</Button>
		</div>
	);
}
