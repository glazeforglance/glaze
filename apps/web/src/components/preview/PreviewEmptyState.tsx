import type { SettingsState } from "../../hooks/use-settings.ts";

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
	if (settings.status === "loading") {
		return <p className="self-center text-sm text-muted">Loading…</p>;
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
				Connect the live preview
			</h3>
			<p className="mt-2">
				Tell Glaze where your browser can reach Glance by setting{" "}
				<code className="font-mono text-text">GLANCE_URL</code>, for example in{" "}
				<code className="font-mono text-text">.env</code>:
			</p>
			<pre className="mt-3 rounded-md border border-line bg-card px-3 py-2 font-mono text-xs text-text">
				GLANCE_URL=http://localhost:8080
			</pre>
			<p className="mt-3">Then restart the Glaze server.</p>
			<p className="mt-3">
				The preview shows the published config. If Glance has a login, you sign
				in once inside the preview.
			</p>
		</div>
	);
}
