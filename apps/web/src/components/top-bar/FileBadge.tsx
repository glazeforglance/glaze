/**
 * Shows which file is being edited.
 * @returns The badge element.
 */
export function FileBadge() {
	// The API doesn't send the file name yet; Glance's config is always glance.yml for now.
	return (
		<span className="rounded-[6px] border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
			glance.yml
		</span>
	);
}
