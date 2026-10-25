import { listsOfPage } from "../../lib/drop-target.ts";
import { selectCurrentPage, useEditor } from "../../store/editor-store.ts";
import { ColumnCard } from "./ColumnCard.tsx";
import { EditNotice } from "./EditNotice.tsx";
import { HeadWidgets } from "./HeadWidgets.tsx";
import { PageHeader } from "./PageHeader.tsx";

/**
 * The center area: the open page with its head widgets and columns.
 * @returns The main element.
 */
export function Canvas() {
	const page = useEditor(selectCurrentPage);
	const selectWidget = useEditor((state) => state.selectWidget);

	if (!page) {
		return (
			<main className="dotted-grid flex flex-1 items-center justify-center text-muted">
				This config has no pages yet.
			</main>
		);
	}

	const [headList, ...columnLists] = listsOfPage(page);

	return (
		<main
			aria-label={`Page ${page.name ?? ""}`}
			className="dotted-grid min-w-0 flex-1 overflow-auto px-6 py-6"
			// Clicking empty canvas clears the selection, like most design tools.
			onClick={(event) => {
				if (event.target === event.currentTarget) selectWidget(null);
			}}
		>
			<PageHeader page={page} />
			<EditNotice />
			{page.include !== null ? (
				<p className="text-sm text-muted">
					This page comes from <code className="font-mono">{page.include}</code>{" "}
					and can't be edited here.
				</p>
			) : (
				<>
					{headList && (
						<HeadWidgets widgets={page.headWidgets} list={headList} />
					)}
					<div className="flex items-start gap-4">
						{page.columns.map((column, index) => {
							const list = columnLists[index];
							return list ? (
								<ColumnCard key={column.id} column={column} list={list} />
							) : null;
						})}
					</div>
				</>
			)}
		</main>
	);
}
