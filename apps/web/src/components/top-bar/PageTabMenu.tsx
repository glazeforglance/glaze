import type { PageNode } from "@glaze/core";
import { useState } from "react";
import { Trans } from "react-i18next";
import { useEditor } from "../../store/editor-store.ts";
import { ConfirmDialog } from "../ui/ConfirmDialog.tsx";
import { MoreIcon } from "../ui/icons.tsx";
import { Menu } from "../ui/Menu.tsx";
import { useTranslation } from "react-i18next";

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
	const { t } = useTranslation();
	const [confirming, setConfirming] = useState(false);
	const startRename = useEditor((state) => state.startRename);
	const movePage = useEditor((state) => state.movePage);
	const removePage = useEditor((state) => state.removePage);
	const name = page.name ?? t("pages.thisPage");

	return (
		<>
			<Menu
				label={t("pages.actionsFor", { name })}
				trigger={<MoreIcon />}
				triggerClassName="flex size-9 items-center justify-center rounded-sm text-muted hover:bg-card hover:text-text"
				items={[
					{ label: t("pages.rename"), onSelect: () => startRename(page.id) },
					{
						// Logical: "earlier" is to the left in LTR and to the right in RTL.
						label: t("pages.moveEarlier"),
						onSelect: () => movePage(page.id, index - 1),
						disabled: index === 0,
					},
					{
						label: t("pages.moveLater"),
						onSelect: () => movePage(page.id, index + 1),
						disabled: index === count - 1,
					},
					{
						label: t("pages.deleteMenu"),
						onSelect: () => setConfirming(true),
						danger: true,
						disabled: count === 1,
					},
				]}
			/>
			<ConfirmDialog
				open={confirming}
				title={
					<Trans
						i18nKey="pages.deleteTitle"
						values={{ name }}
						components={{ name: <bdi /> }}
					/>
				}
				confirmLabel={t("pages.delete")}
				onCancel={() => setConfirming(false)}
				onConfirm={() => {
					setConfirming(false);
					removePage(page.id);
				}}
			>
				{t("pages.deleteBody")}
			</ConfirmDialog>
		</>
	);
}
