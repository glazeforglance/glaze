import { useState } from "react";
import { PreviewPane } from "../preview/PreviewPane.tsx";
import { CodePanel } from "./CodePanel.tsx";
import { ResizeHandle } from "../ui/ResizeHandle.tsx";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "glaze:code-split";
const CODE_PANE_ID = "code-pane";

interface SplitSettings {
	readonly ratio: number;
	readonly previewOpen: boolean;
}

const DEFAULT_SPLIT: SplitSettings = { ratio: 0.52, previewOpen: true };
const SPLIT_BOUNDS = { min: 0.25, max: 0.8 };

// Only a per-browser convenience; storage can be blocked, so never rely on it.
function readSplit(): SplitSettings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const value: unknown = raw ? JSON.parse(raw) : null;
		if (typeof value === "object" && value !== null) {
			const { ratio, previewOpen } = value as Record<string, unknown>;
			if (typeof ratio === "number" && typeof previewOpen === "boolean") {
				return { ratio, previewOpen };
			}
		}
	} catch {
		// Fall back to the default below.
	}
	return DEFAULT_SPLIT;
}

function writeSplit(split: SplitSettings): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(split));
	} catch {
		// Not remembered; that's fine.
	}
}

/**
 * The Code view: the editor at the start (left in LTR) and, optionally, the
 * live preview at the end with a draggable split. Kept mounted while hidden (see `CodePanel`).
 * @param props - `active`: whether the Code view is showing.
 * @returns The workspace.
 */
export function CodeWorkspace({ active }: { readonly active: boolean }) {
	const { t } = useTranslation();
	const [split, setSplit] = useState(readSplit);
	const [resizing, setResizing] = useState(false);

	const update = (change: Partial<SplitSettings>) => {
		const next = { ...split, ...change };
		setSplit(next);
		writeSplit(next);
	};

	return (
		<div
			hidden={!active}
			className="min-h-0 min-w-0 flex-1 [&:not([hidden])]:flex"
		>
			<div
				id={CODE_PANE_ID}
				className="flex min-h-0 min-w-0"
				style={{
					flexBasis: split.previewOpen ? `${split.ratio * 100}%` : "100%",
				}}
			>
				<CodePanel
					active={active}
					onShowPreview={
						split.previewOpen ? null : () => update({ previewOpen: true })
					}
				/>
			</div>
			{/* Only while visible: a hidden iframe would keep loading Glance for nothing. */}
			{split.previewOpen && active && (
				<>
					<ResizeHandle
						value={split.ratio}
						{...SPLIT_BOUNDS}
						step={0.05}
						direction={1}
						fromPointer={(start, deltaX, container) =>
							start + deltaX / container.width
						}
						ariaValue={(ratio) => Math.round(ratio * 100)}
						onChange={(ratio) => update({ ratio })}
						onReset={() => update({ ratio: DEFAULT_SPLIT.ratio })}
						onDragChange={setResizing}
						label={t("code.resizeSplit")}
						controls={CODE_PANE_ID}
						className="relative"
					/>
					<div className="flex min-h-0 min-w-0 flex-1">
						<PreviewPane
							resizing={resizing}
							onHide={() => update({ previewOpen: false })}
						/>
					</div>
				</>
			)}
		</div>
	);
}
