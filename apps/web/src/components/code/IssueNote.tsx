import type { ValidationIssue } from "@glaze/core";
import { useTranslation } from "react-i18next";
import { problemText } from "../../lib/messages.ts";

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
	const { t } = useTranslation();
	return (
		<p className={className}>
			{problemText(issue)}
			{issue.docsUrl !== undefined && (
				<>
					{" "}
					<a
						href={issue.docsUrl}
						target="_blank"
						rel="noreferrer"
						className="underline hover:text-text"
					>
						{t("code.howToSetUp")}
					</a>
				</>
			)}
		</p>
	);
}
