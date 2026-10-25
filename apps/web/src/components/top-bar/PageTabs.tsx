import { useEditor } from "../../store/editor-store.ts";
import { Button } from "../ui/Button.tsx";
import { PlusIcon } from "../ui/icons.tsx";
import { PageNameInput } from "./PageNameInput.tsx";
import { PageTabMenu } from "./PageTabMenu.tsx";

/**
 * One tab per page (double-click to rename), the open page's actions menu, and "+ Page".
 * @returns The tab bar.
 */
export function PageTabs() {
	const pages = useEditor((state) => state.pages);
	const selectedPageId = useEditor((state) => state.selectedPageId);
	const renamingPageId = useEditor((state) => state.renamingPageId);
	const selectPage = useEditor((state) => state.selectPage);
	const startRename = useEditor((state) => state.startRename);
	const addPage = useEditor((state) => state.addPage);
	const selectedIndex = pages.findIndex((page) => page.id === selectedPageId);
	const selected = pages[selectedIndex];

	return (
		<div className="flex min-w-0 items-center gap-1">
			<div
				role="tablist"
				aria-label="Pages"
				className="flex min-w-0 items-center gap-1 overflow-x-auto"
			>
				{pages.map((page, index) =>
					page.id === renamingPageId ? (
						<PageNameInput key={page.id} page={page} />
					) : (
						<button
							key={page.id}
							type="button"
							role="tab"
							aria-selected={page.id === selectedPageId}
							onClick={() => selectPage(page.id)}
							onDoubleClick={() => startRename(page.id)}
							className={`min-h-9 cursor-pointer rounded-sm px-3.5 text-sm whitespace-nowrap transition-colors ${
								page.id === selectedPageId
									? "bg-card font-semibold text-text"
									: "text-muted hover:bg-card hover:text-text"
							}`}
						>
							{page.name ??
								(page.include ? `Include ${index + 1}` : `Page ${index + 1}`)}
						</button>
					),
				)}
			</div>
			{/* Outside the tablist: a tablist may only contain tabs. */}
			{selected && (
				<PageTabMenu
					page={selected}
					index={selectedIndex}
					count={pages.length}
				/>
			)}
			<Button onClick={addPage} className="ml-1 border-dashed">
				<PlusIcon />
				Page
			</Button>
		</div>
	);
}
