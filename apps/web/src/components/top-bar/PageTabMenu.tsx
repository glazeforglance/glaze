import type { PageNode } from "@glaze/core";
import { useState } from "react";
import { useEditor } from "../../store/editor-store.ts";
import { ConfirmDialog } from "../ui/ConfirmDialog.tsx";
import { MoreIcon } from "../ui/icons.tsx";
import { Menu } from "../ui/Menu.tsx";

export interface PageTabMenuProps {
	readonly page: PageNode;
	readonly index: number;
	readonly count: number;
}

/**
 * Actions for the open page: rename, move left/right and delete (with confirm).
 * @param props - The open page, its position and the number of pages.
 * @returns The menu button and its delete confirmation.
 */
export function PageTabMenu({ page, index, count }: PageTabMenuProps) {
	const [confirming, setConfirming] = useState(false);
	const startRename = useEditor((state) => state.startRename);
	const movePage = useEditor((state) => state.movePage);
	const removePage = useEditor((state) => state.removePage);
	const name = page.name ?? "this page";

	return (
		<>
			<Menu
				label={`Actions for page ${name}`}
				trigger={<MoreIcon />}
				triggerClassName="flex size-9 items-center justify-center rounded-sm text-muted hover:bg-card hover:text-text"
				items={[
					{ label: "Rename", onSelect: () => startRename(page.id) },
					{
						label: "Move left",
						onSelect: () => movePage(page.id, index - 1),
						disabled: index === 0,
					},
					{
						label: "Move right",
						onSelect: () => movePage(page.id, index + 1),
						disabled: index === count - 1,
					},
					{
						label: "Delete page…",
						onSelect: () => setConfirming(true),
						danger: true,
						disabled: count === 1,
					},
				]}
			/>
			<ConfirmDialog
				open={confirming}
				title={`Delete “${name}”?`}
				confirmLabel="Delete page"
				onCancel={() => setConfirming(false)}
				onConfirm={() => {
					setConfirming(false);
					removePage(page.id);
				}}
			>
				The page and all its columns and widgets are removed from the config.
				Nothing is written to disk until you publish.
			</ConfirmDialog>
		</>
	);
}
