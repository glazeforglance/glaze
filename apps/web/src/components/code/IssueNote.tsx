import type { ValidationIssue } from "@glaze/core";

/**
 * An info issue as a short line of text, with a link to the docs when the
 * issue has one (e.g. how to set `GLAZE_ASSETS_PATH`).
 * @param props - The issue and the line's classes.
 * @returns The note.
 */
export function IssueNote({
	issue,
	className,
}: {
	readonly issue: ValidationIssue;
	readonly className: string;
}) {
	return (
		<p className={className}>
			{issue.message}
			{issue.docsUrl !== undefined && (
				<>
					{" "}
					<a
						href={issue.docsUrl}
						target="_blank"
						rel="noreferrer"
						className="underline hover:text-text"
					>
						How to set it up
					</a>
				</>
			)}
		</p>
	);
}
