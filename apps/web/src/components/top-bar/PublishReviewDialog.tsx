import type { ValidationIssue } from "@glaze/core";
import { useEffect, useState } from "react";
import { configNeedsPublish } from "../../hooks/use-publish.ts";
import { useDraftText } from "../../hooks/use-validation.ts";
import { validateConfig } from "../../lib/api.ts";
import { editorStore, useEditor } from "../../store/editor-store.ts";
import { isFileDirty, useFiles } from "../../store/files-store.ts";
import { Button } from "../ui/Button.tsx";
import { Dialog } from "../ui/Dialog.tsx";

export interface PublishReviewDialogProps {
	readonly open: boolean;
	readonly onCancel: () => void;
	/** Publishes; `force` is true for "Publish anyway". */
	readonly onPublish: (force: boolean) => void;
}

type Check =
	| { readonly status: "checking" }
	| { readonly status: "done"; readonly issues: readonly ValidationIssue[] }
	| { readonly status: "failed"; readonly message: string };

function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}

const SEVERITY_DOT: Record<ValidationIssue["severity"], string> = {
	error: "bg-danger",
	warning: "bg-accent",
	info: "bg-info",
};

/**
 * The step before writing: which files change, and what validation found.
 * Errors block Publish (with an explicit "Publish anyway", except for broken
 * YAML); warnings are listed but never block.
 * @param props - Open state and handlers.
 * @returns The dialog.
 */
export function PublishReviewDialog({
	open,
	onCancel,
	onPublish,
}: PublishReviewDialogProps) {
	const draft = useDraftText();
	const setView = useEditor((state) => state.setView);
	// Select the list itself: a selector that builds a new array would re-render forever.
	const allFiles = useFiles((state) => state.files);
	const changedFiles = allFiles.filter(isFileDirty).map((file) => file.name);
	const validation = useEditor((state) => state.validation);
	const configDirty = useEditor(
		(state) => state.dirty || state.codeText !== null,
	);
	const [failure, setFailure] = useState<{
		readonly text: string;
		readonly message: string;
	} | null>(null);
	const configChanged = open && configDirty;

	// Validate the draft that is about to be written, unless a fresh result exists.
	useEffect(() => {
		if (!open || draft === null || !configNeedsPublish()) return;
		if (editorStore.getState().validation?.text === draft) return;
		const controller = new AbortController();
		void validateConfig(draft, controller.signal).then((result) => {
			if (controller.signal.aborted) return;
			if (result.ok) {
				editorStore
					.getState()
					.setValidation({ text: draft, issues: result.value });
			} else {
				setFailure({ text: draft, message: result.error.message });
			}
		});
		return () => controller.abort();
	}, [open, draft]);

	// Derived: only results for exactly this draft count.
	const check: Check = !configChanged
		? { status: "done", issues: [] }
		: validation !== null && validation.text === draft
			? { status: "done", issues: validation.issues }
			: failure !== null && failure.text === draft
				? { status: "failed", message: failure.message }
				: { status: "checking" };

	const issues = check.status === "done" ? check.issues : [];
	const errors = issues.filter((issue) => issue.severity === "error");
	const warnings = issues.filter((issue) => issue.severity === "warning");
	const notes = issues.filter((issue) => issue.severity === "info");
	const yamlBroken = errors.some((issue) => issue.source === "yaml");
	const files = [...(configChanged ? ["glance.yml"] : []), ...changedFiles];

	const blocked =
		check.status === "checking"
			? "Checking the config…"
			: errors.length > 0
				? "Fix the errors first, or use Publish anyway"
				: undefined;

	return (
		<Dialog
			open={open}
			size="wide"
			title="Publish changes"
			onClose={onCancel}
			actions={
				<>
					<Button autoFocus onClick={onCancel}>
						Cancel
					</Button>
					{errors.length > 0 && !yamlBroken && (
						<Button variant="danger" onClick={() => onPublish(true)}>
							Publish anyway
						</Button>
					)}
					<Button
						variant="primary"
						unavailable={blocked}
						onClick={() => onPublish(false)}
					>
						Publish
					</Button>
				</>
			}
		>
			<section aria-label="Files that change">
				<p>
					{files.length === 0
						? "Nothing has changed."
						: `${plural(files.length, "file")} will be written:`}
				</p>
				{files.length > 0 && (
					<ul className="mt-2 flex flex-wrap gap-1.5">
						{files.map((name) => (
							<li
								key={name}
								className="rounded-[6px] border border-line-strong px-2 py-0.5 font-mono text-xs text-text"
							>
								{name}
							</li>
						))}
					</ul>
				)}
			</section>

			<section aria-label="Validation" className="mt-4" aria-live="polite">
				{check.status === "checking" && <p>Checking the config…</p>}
				{check.status === "failed" && (
					<p className="text-danger">
						Couldn't check the config: {check.message}. The server checks it
						again when you publish.
					</p>
				)}
				{check.status === "done" && configChanged && (
					<p>
						<span
							className={errors.length > 0 ? "font-semibold text-danger" : ""}
						>
							{plural(errors.length, "error")}
						</span>
						{" · "}
						<span
							className={warnings.length > 0 ? "font-semibold text-accent" : ""}
						>
							{plural(warnings.length, "warning")}
						</span>
						{errors.length === 0 && " — ready to publish."}
					</p>
				)}
				{yamlBroken && (
					<p className="mt-2 text-text">
						The YAML can't be read, so it can't be published, not even anyway.{" "}
						<button
							type="button"
							onClick={() => {
								onCancel();
								setView("code");
							}}
							className="cursor-pointer font-semibold underline"
						>
							Open the Code view
						</button>
					</p>
				)}
				{errors.length + warnings.length > 0 && (
					<ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-1">
						{[...errors, ...warnings].map((issue, index) => (
							<li
								// Issues have no id; the list is replaced as a whole.
								key={`${index}-${issue.message}`}
								className="flex items-start gap-2 text-text"
							>
								<span
									aria-hidden="true"
									className={`mt-1.5 size-2 shrink-0 rounded-full ${SEVERITY_DOT[issue.severity]}`}
								/>
								<span>
									<span className="sr-only">{issue.severity}: </span>
									{issue.line !== undefined && (
										<span className="font-semibold">Line {issue.line}: </span>
									)}
									<span className="text-muted">{issue.message}</span>
								</span>
							</li>
						))}
					</ul>
				)}
				{notes.map((issue) => (
					<p key={issue.message} className="mt-3 text-xs text-faint">
						{issue.message}
					</p>
				))}
			</section>
		</Dialog>
	);
}
