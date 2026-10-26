import { useEffect, useRef, useState } from "react";
import { useSettings } from "../../hooks/use-settings.ts";
import { useHasUnsavedChanges } from "../../hooks/use-unsaved.ts";
import { previewUrl, waitForGlance } from "../../lib/preview.ts";
import { selectCurrentPage, useEditor } from "../../store/editor-store.ts";
import { DesktopIcon, PhoneIcon, ReloadIcon, SplitIcon } from "../ui/icons.tsx";
import { PreviewEmptyState } from "./PreviewEmptyState.tsx";

type Device = "desktop" | "phone";

type ReloadStatus =
	| { readonly phase: "idle" }
	| { readonly phase: "waiting" }
	| { readonly phase: "reloaded"; readonly at: Date };

const TIME = new Intl.DateTimeFormat(undefined, {
	hour: "2-digit",
	minute: "2-digit",
});

const iconButton =
	"inline-flex size-9 cursor-pointer items-center justify-center rounded-sm border text-muted hover:text-text";

export interface PreviewPaneProps {
	/** Hides the pane (only next to the code); leave out for the full Preview view. */
	readonly onHide?: () => void;
	/** True while the split is being dragged: the iframe must not swallow the pointer. */
	readonly resizing?: boolean;
}

/**
 * The real Glance in an iframe, on the page that is open in Glaze. It shows
 * the published config: after a Publish it waits for Glance to reload and then
 * reloads itself, staying on the same page.
 * @param props - Optional hide handler and resize state.
 * @returns The preview section.
 */
export function PreviewPane({ onHide, resizing = false }: PreviewPaneProps) {
	const settings = useSettings();
	const page = useEditor(selectCurrentPage);
	const pageIndex = useEditor((state) =>
		state.pages.findIndex((candidate) => candidate.id === state.selectedPageId),
	);
	const publishCount = useEditor((state) => state.publishCount);
	const unsaved = useHasUnsavedChanges();
	const [device, setDevice] = useState<Device>("desktop");
	const [frameKey, setFrameKey] = useState(0);
	const [status, setStatus] = useState<ReloadStatus>({ phase: "idle" });
	const handledPublish = useRef(publishCount);

	const glanceUrl =
		settings.status === "ready" ? settings.settings.glanceUrl : null;

	// After a Publish: wait until Glance picked up the file, then reload.
	useEffect(() => {
		if (glanceUrl === null || handledPublish.current === publishCount) return;
		handledPublish.current = publishCount;
		const controller = new AbortController();
		setStatus({ phase: "waiting" });
		void waitForGlance(glanceUrl, controller.signal).then(() => {
			if (controller.signal.aborted) return;
			setFrameKey((key) => key + 1);
			setStatus({ phase: "reloaded", at: new Date() });
		});
		return () => controller.abort();
	}, [publishCount, glanceUrl]);

	const src =
		glanceUrl === null ? null : previewUrl(glanceUrl, page, pageIndex);

	return (
		<section
			aria-label="Live preview"
			className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg"
		>
			<div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
				<h2 className="font-mono text-xs font-semibold tracking-wider text-muted uppercase">
					Live preview
				</h2>
				<p role="status" className="min-w-0 truncate font-mono text-xs">
					{status.phase === "waiting" && (
						<span className="text-muted">Waiting for Glance to reload…</span>
					)}
					{status.phase === "reloaded" && (
						<span className="inline-flex items-center gap-1.5 text-success">
							<span
								aria-hidden="true"
								className="size-1.5 rounded-full bg-success"
							/>
							Glance reloaded · {TIME.format(status.at)}
						</span>
					)}
				</p>
				<div className="ml-auto flex items-center gap-1.5">
					<div role="group" aria-label="Device" className="flex gap-1.5">
						{(
							[
								["desktop", "Desktop", DesktopIcon],
								["phone", "Phone (390 px)", PhoneIcon],
							] as const
						).map(([id, label, Icon]) => (
							<button
								key={id}
								type="button"
								aria-label={label}
								aria-pressed={device === id}
								title={label}
								onClick={() => setDevice(id)}
								className={`${iconButton} ${
									device === id
										? "border-accent text-accent"
										: "border-line bg-bg"
								}`}
							>
								<Icon />
							</button>
						))}
					</div>
					<button
						type="button"
						aria-label="Reload preview"
						title="Reload preview"
						disabled={src === null}
						onClick={() => setFrameKey((key) => key + 1)}
						className={`${iconButton} border-line disabled:cursor-not-allowed disabled:opacity-50`}
					>
						<ReloadIcon />
					</button>
					{onHide && (
						<button
							type="button"
							aria-label="Hide preview"
							title="Hide preview"
							onClick={onHide}
							className={`${iconButton} border-line`}
						>
							<SplitIcon />
						</button>
					)}
				</div>
			</div>

			<div className="flex min-h-0 flex-1 justify-center p-4">
				{src === null ? (
					<PreviewEmptyState settings={settings} />
				) : (
					<div
						className={`h-full overflow-hidden rounded-lg border border-line-strong bg-canvas ${
							device === "phone" ? "w-[390px] max-w-full" : "w-full"
						}`}
					>
						<iframe
							key={frameKey}
							src={src}
							title={`Glance preview: ${page?.name ?? "first page"}`}
							// Glance runs on another origin. No allow-top-navigation,
							// so links inside the preview can't navigate Glaze away.
							sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
							referrerPolicy="no-referrer"
							className={`size-full bg-canvas ${resizing ? "pointer-events-none" : ""}`}
						/>
					</div>
				)}
			</div>

			<p className="shrink-0 px-4 pb-3 text-xs text-muted">
				Preview shows the last published version.
				{unsaved && (
					<span className="ml-1.5 inline-flex items-center gap-1.5">
						<span
							aria-hidden="true"
							className="size-1.5 rounded-full bg-accent"
						/>
						Unsaved changes aren't in it yet; Publish to see them.
					</span>
				)}
			</p>
		</section>
	);
}
