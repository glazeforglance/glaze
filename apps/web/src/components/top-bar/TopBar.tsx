import { FileBadge } from "./FileBadge.tsx";
import { Logo } from "./Logo.tsx";
import { PageTabs } from "./PageTabs.tsx";
import { PublishButton } from "./PublishButton.tsx";
import { UndoButton } from "./UndoButton.tsx";
import { UnsavedIndicator } from "./UnsavedIndicator.tsx";
import { ViewSwitch } from "./ViewSwitch.tsx";

/**
 * The bar at the top: logo and file, page tabs, view switch, undo and Publish.
 * @returns The header element.
 */
export function TopBar() {
	return (
		<header className="flex h-[62px] shrink-0 items-center gap-4 border-b border-line bg-bg px-4">
			<div className="flex items-center gap-2.5">
				<Logo />
				<FileBadge />
			</div>
			<PageTabs />
			<div className="ml-auto flex items-center gap-2.5">
				<ViewSwitch />
				<UndoButton />
				<UnsavedIndicator />
				<PublishButton />
			</div>
		</header>
	);
}
