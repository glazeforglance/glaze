import { useState } from "react";
import { hasUnsavedChanges } from "../../hooks/use-unsaved.ts";
import { GLAZE_VERSION } from "../../lib/version.ts";
import { authStore, useAuth } from "../../store/auth-store.ts";
import { editorStore } from "../../store/editor-store.ts";
import { filesStore } from "../../store/files-store.ts";
import { ConfirmDialog } from "../ui/ConfirmDialog.tsx";
import { ChevronDownIcon, UserIcon } from "../ui/icons.tsx";
import { Menu } from "../ui/Menu.tsx";

/** Logs out and clears what was loaded, so the next login starts fresh. */
async function logOutNow(): Promise<void> {
	await authStore.getState().logOut();
	editorStore.setState({ status: "loading" });
	filesStore.setState({ files: [], unavailable: null, loaded: false });
}

/**
 * The user menu in the top bar: who is signed in, the version, and Log out.
 * Logging out with unpublished changes asks first, because they'd be lost.
 * @returns The menu, or nothing when auth is off.
 */
export function UserMenu() {
	const user = useAuth((state) => state.user);
	const [confirming, setConfirming] = useState(false);
	if (user === null) return null;

	const requestLogOut = () => {
		if (hasUnsavedChanges()) setConfirming(true);
		else void logOutNow();
	};

	return (
		<>
			<Menu
				label={`Signed in as ${user}`}
				align="right"
				triggerClassName="flex min-h-9 items-center gap-1.5 rounded-sm px-2 text-sm text-muted hover:bg-card hover:text-text"
				trigger={
					<>
						<UserIcon />
						<span className="max-w-32 truncate">{user}</span>
						<ChevronDownIcon />
					</>
				}
				header={
					<>
						Signed in as <span className="text-text">{user}</span>
						<span className="mt-0.5 block font-mono text-[11px] text-faint">
							Glaze v{GLAZE_VERSION}
						</span>
					</>
				}
				items={[{ label: "Log out", onSelect: requestLogOut }]}
			/>
			<ConfirmDialog
				open={confirming}
				title="Log out with unpublished changes?"
				confirmLabel="Log out"
				onCancel={() => setConfirming(false)}
				onConfirm={() => {
					setConfirming(false);
					void logOutNow();
				}}
			>
				Your changes haven't been published yet. If you log out now, they're
				lost.
			</ConfirmDialog>
		</>
	);
}
