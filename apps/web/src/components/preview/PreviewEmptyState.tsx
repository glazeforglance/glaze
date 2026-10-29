import type { SettingsState } from "../../hooks/use-settings.ts";
import { Trans, useTranslation } from "react-i18next";

/**
 * Shown instead of the iframe when there is nothing to show: settings still
 * loading, the API unreachable, or `GLANCE_URL` not set.
 * @param props - The settings state.
 * @returns The explanation.
 */
export function PreviewEmptyState({
	settings,
}: {
	readonly settings: SettingsState;
}) {
	const { t } = useTranslation();
	if (settings.status === "loading") {
		return (
			<p className="self-center text-sm text-muted">{t("common.loading")}</p>
		);
	}
	if (settings.status === "error") {
		return (
			<p role="alert" className="self-center text-sm text-danger">
				{settings.message}
			</p>
		);
	}
	return (
		<div className="max-w-md self-center rounded-lg border border-dashed border-line-strong p-6 text-sm text-muted">
			<h3 className="text-base font-semibold text-text">
				{t("preview.connect.title")}
			</h3>
			<p className="mt-2">
				<Trans
					i18nKey="preview.connect.body"
					components={{
						code: <code dir="ltr" className="font-mono text-text" />,
					}}
				/>
			</p>
			<pre
				dir="ltr"
				className="mt-3 rounded-md border border-line bg-card px-3 py-2 font-mono text-xs text-text"
			>
				GLANCE_URL=http://localhost:8080
			</pre>
			<p className="mt-3">{t("preview.connect.restart")}</p>
			<p className="mt-3">{t("preview.connect.login")}</p>
		</div>
	);
}
