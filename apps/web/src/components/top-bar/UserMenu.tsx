import { useState } from "react";
import { useTranslation } from "react-i18next";
import { hasUnsavedChanges } from "../../hooks/use-unsaved.ts";
import { changeLanguage, PICKER_LANGUAGES, useLanguage } from "../../i18n.ts";
import { languageName } from "../../lib/languages.ts";
import { GLAZE_VERSION } from "../../lib/version.ts";
import { authStore, useAuth } from "../../store/auth-store.ts";
import { editorStore } from "../../store/editor-store.ts";
import { filesStore } from "../../store/files-store.ts";
import { ConfirmDialog } from "../ui/ConfirmDialog.tsx";
import { ChevronDownIcon, LanguageIcon, UserIcon } from "../ui/icons.tsx";
import { Menu, type MenuItem } from "../ui/Menu.tsx";

/** Logs out and clears what was loaded, so the next login starts fresh. */
async function logOutNow(): Promise<void> {
	await authStore.getState().logOut();
	editorStore.setState({ status: "loading" });
	filesStore.setState({ files: [], unavailable: null, loaded: false });
}

/**
 * The user menu in the top bar: who is signed in, the version, the UI
 * language and Log out. Languages are listed in their own names, so people
 * find theirs whatever the UI shows now. With auth off it holds only the
 * languages. Logging out with unpublished changes asks first.
 * @returns The menu.
 */
export function UserMenu() {
	const { t } = useTranslation();
	const { language } = useLanguage();
	const user = useAuth((state) => state.user);
	const [confirming, setConfirming] = useState(false);

	const requestLogOut = () => {
		if (hasUnsavedChanges()) setConfirming(true);
		else void logOutNow();
	};

	const languages: MenuItem[] = PICKER_LANGUAGES.map((code) => ({
		label: languageName(code),
		lang: code,
		checked: code === language,
		onSelect: () => void changeLanguage(code),
	}));
	const version = (
		<span dir="ltr" className="mt-0.5 block font-mono text-[11px] text-faint">
			Glaze v{GLAZE_VERSION}
		</span>
	);

	if (user === null) {
		return (
			<Menu
				label={t("userMenu.language")}
				align="end"
				triggerClassName="flex min-h-9 items-center gap-1.5 rounded-sm px-2 text-sm text-muted hover:bg-card hover:text-text"
				trigger={
					<>
						<LanguageIcon />
						<ChevronDownIcon />
					</>
				}
				header={
					<>
						{t("userMenu.language")}
						{version}
					</>
				}
				items={languages}
			/>
		);
	}

	return (
		<>
			<Menu
				label={t("userMenu.signedInAs", { user })}
				align="end"
				triggerClassName="flex min-h-9 items-center gap-1.5 rounded-sm px-2 text-sm text-muted hover:bg-card hover:text-text"
				trigger={
					<>
						<UserIcon />
						<bdi className="max-w-32 truncate">{user}</bdi>
						<ChevronDownIcon />
					</>
				}
				header={
					<>
						{t("userMenu.signedIn")} <bdi className="text-text">{user}</bdi>
						{version}
					</>
				}
				items={[
					...languages.map((item, index) =>
						index === 0
							? { ...item, groupLabel: t("userMenu.language") }
							: item,
					),
					{
						label: t("userMenu.logOut"),
						onSelect: requestLogOut,
						separated: true,
					},
				]}
			/>
			<ConfirmDialog
				open={confirming}
				title={t("userMenu.logOutTitle")}
				confirmLabel={t("userMenu.logOut")}
				onCancel={() => setConfirming(false)}
				onConfirm={() => {
					setConfirming(false);
					void logOutNow();
				}}
			>
				{t("userMenu.logOutBody")}
			</ConfirmDialog>
		</>
	);
}
