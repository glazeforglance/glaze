import type { ValidationIssue } from "@glaze/core";
import { useEffect, useState } from "react";
import { configNeedsPublish } from "../../hooks/use-publish.ts";
import { useDraftText } from "../../hooks/use-validation.ts";
import { validateConfig } from "../../lib/api.ts";
import { editorStore, useEditor } from "../../store/editor-store.ts";
import { isFileDirty, useFiles } from "../../store/files-store.ts";
import { IssueNote } from "../code/IssueNote.tsx";
import { Button } from "../ui/Button.tsx";
import { Dialog } from "../ui/Dialog.tsx";
import { useTranslation } from "react-i18next";
import { problemText } from "../../lib/messages.ts";

export interface PublishReviewDialogProps {
	readonly open: boolean;
	readonly onCancel: () => void;
	/**
	 * Publishes; `force` is true for "Publish anyway", `confirmed` when the
	 * user ticked the box for issues that need it.
	 */
	readonly onPublish: (force: boolean, confirmed: boolean) => void;
}

type Check =
	| { readonly status: "checking" }
	| { readonly status: "done"; readonly issues: readonly ValidationIssue[] }
	| { readonly status: "failed"; readonly message: string };

const SEVERITY_DOT: Record<ValidationIssue["severity"], string> = {
	error: "bg-danger",
	warning: "bg-accent",
	info: "bg-info",
};

/**
 * The step before writing: which files change, and what validation found.
 * Errors block Publish (with an explicit "Publish anyway", except for broken
 * YAML); warnings are listed but never block, except a warning that needs an
 * explicit confirmation (a host/port change behind a Docker port mapping).
 * @param props - Open state and handlers.
 * @returns The dialog.
 */
export function PublishReviewDialog({
	open,
	onCancel,
	onPublish,
}: PublishReviewDialogProps) {
	const { t } = useTranslation();
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
	// Tied to the draft: any further edit asks again.
	const [confirmedDraft, setConfirmedDraft] = useState<string | null>(null);

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
	const toConfirm = issues.filter((issue) => issue.requiresConfirmation);
	const confirmed =
		toConfirm.length === 0 || (draft !== null && confirmedDraft === draft);
	// Issues to confirm get their own box below instead of a line in the list.
	const listed = [...errors, ...warnings].filter(
		(issue) => !issue.requiresConfirmation,
	);
	const files = [...(configChanged ? ["glance.yml"] : []), ...changedFiles];

	const blocked =
		check.status === "checking"
			? t("publish.review.checking")
			: errors.length > 0
				? t("publish.review.fixFirst")
				: !confirmed
					? t("publish.review.confirmFirst")
					: undefined;

	return (
		<Dialog
			open={open}
			size="wide"
			title={t("publish.review.title")}
			onClose={onCancel}
			actions={
				<>
					<Button autoFocus onClick={onCancel}>
						{t("common.cancel")}
					</Button>
					{errors.length > 0 && !yamlBroken && (
						<Button
							variant="danger"
							unavailable={
								confirmed ? undefined : t("publish.review.confirmFirst")
							}
							onClick={() => onPublish(true, confirmed)}
						>
							{t("publish.review.anyway")}
						</Button>
					)}
					<Button
						variant="primary"
						unavailable={blocked}
						onClick={() => onPublish(false, confirmed)}
					>
						{t("publish.button")}
					</Button>
				</>
			}
		>
			<section aria-label={t("publish.review.filesLabel")}>
				<p>
					{files.length === 0
						? t("publish.review.nothing")
						: t("publish.review.files", { count: files.length })}
				</p>
				{files.length > 0 && (
					<ul className="mt-2 flex flex-wrap gap-1.5">
						{files.map((name) => (
							<li
								key={name}
								dir="ltr"
								className="rounded-[6px] border border-line-strong px-2 py-0.5 font-mono text-xs text-text"
							>
								{name}
							</li>
						))}
					</ul>
				)}
			</section>

			<section
				aria-label={t("publish.review.validation")}
				className="mt-4"
				aria-live="polite"
			>
				{check.status === "checking" && <p>{t("publish.review.checking")}</p>}
				{check.status === "failed" && (
					<p className="text-danger">
						{t("publish.review.checkFailed", { message: check.message })}
					</p>
				)}
				{check.status === "done" && configChanged && (
					<p>
						<span
							className={errors.length > 0 ? "font-semibold text-danger" : ""}
						>
							{t("publish.review.errors", { count: errors.length })}
						</span>
						{" · "}
						<span
							className={warnings.length > 0 ? "font-semibold text-accent" : ""}
						>
							{t("publish.review.warnings", { count: warnings.length })}
						</span>
						{errors.length === 0 && ` — ${t("publish.review.ready")}`}
					</p>
				)}
				{yamlBroken && (
					<p className="mt-2 text-text">
						{t("publish.review.yamlBroken")}{" "}
						<button
							type="button"
							onClick={() => {
								onCancel();
								setView("code");
							}}
							className="cursor-pointer font-semibold underline"
						>
							{t("publish.review.openCode")}
						</button>
					</p>
				)}
				{listed.length > 0 && (
					<ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pe-1">
						{listed.map((issue, index) => (
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
									<span className="sr-only">
										{t(`code.severity.${issue.severity}`)}{" "}
									</span>
									{issue.line !== undefined && (
										<span className="font-semibold">
											{t("code.line", { line: issue.line })}{" "}
										</span>
									)}
									<span className="text-muted">{problemText(issue)}</span>
								</span>
							</li>
						))}
					</ul>
				)}
				{toConfirm.length > 0 && (
					<div
						role="alert"
						className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2.5"
					>
						{toConfirm.map((issue) => (
							<p key={issue.message} className="font-semibold text-text">
								{problemText(issue)}
							</p>
						))}
						<label className="mt-2 flex cursor-pointer items-start gap-2 text-text">
							<input
								type="checkbox"
								checked={confirmed}
								onChange={(event) =>
									setConfirmedDraft(event.target.checked ? draft : null)
								}
								className="mt-1"
							/>
							{t("publish.review.understand")}
						</label>
					</div>
				)}
				{notes.map((issue) => (
					<IssueNote
						key={issue.message}
						issue={issue}
						className="mt-3 text-xs text-faint"
					/>
				))}
			</section>
		</Dialog>
	);
}
