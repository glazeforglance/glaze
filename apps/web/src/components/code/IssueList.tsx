import type { RenameKeyFix, ValidationIssue } from "@glaze/core";
import { Button } from "../ui/Button.tsx";

const DOT: Record<ValidationIssue["severity"], string> = {
	error: "bg-danger",
	warning: "bg-accent",
	info: "bg-info",
};

export interface IssueListProps {
	readonly issues: readonly ValidationIssue[];
	/** True while the issues belong to an older version of the text. */
	readonly stale: boolean;
	readonly onJump: (line: number) => void;
	/** Applies a fix; `null` while fixes can't be applied (e.g. the YAML is broken). */
	readonly onFix: ((fix: RenameKeyFix) => void) | null;
}

/**
 * The problems found in the draft, under the editor. Clicking one jumps to its
 * line; unknown-option warnings with a suggestion get a Fix button.
 * @param props - Issues and handlers.
 * @returns The list, or a short "no problems" line.
 */
export function IssueList({ issues, stale, onJump, onFix }: IssueListProps) {
	const problems = issues.filter((issue) => issue.severity !== "info");
	const notes = issues.filter((issue) => issue.severity === "info");
	return (
		<section
			aria-label="Problems"
			className={`max-h-48 shrink-0 overflow-y-auto border-t border-line bg-canvas ${stale ? "opacity-70" : ""}`}
		>
			{problems.length === 0 && (
				<p className="px-4 py-3 text-sm text-muted">
					{stale ? "Checking…" : "No problems found."}
				</p>
			)}
			<ul>
				{problems.map((issue, index) => (
					<li
						// Issues have no id; position plus text is unique enough for a list that is replaced as a whole.
						key={`${index}-${issue.line}-${issue.message}`}
						className="flex items-center gap-3 border-b border-line/60 px-4 py-2 last:border-b-0"
					>
						<span
							aria-hidden="true"
							className={`size-2 shrink-0 rounded-full ${DOT[issue.severity]}`}
						/>
						<button
							type="button"
							disabled={issue.line === undefined}
							onClick={() => issue.line !== undefined && onJump(issue.line)}
							className="min-w-0 flex-1 cursor-pointer text-left text-sm disabled:cursor-default"
						>
							<span className="sr-only">{issue.severity}: </span>
							{issue.line !== undefined && (
								<span className="font-semibold">Line {issue.line}: </span>
							)}
							<span className="text-muted">{issue.message}</span>
						</button>
						{issue.fix && onFix && (
							<Button
								className="shrink-0"
								aria-label={`Fix: rename ${issue.fix.from} to ${issue.fix.to}`}
								onClick={() => issue.fix && onFix(issue.fix)}
							>
								Fix
							</Button>
						)}
					</li>
				))}
			</ul>
			{notes.map((issue) => (
				<p key={issue.message} className="px-4 py-2 text-xs text-faint">
					{issue.message}
				</p>
			))}
		</section>
	);
}
