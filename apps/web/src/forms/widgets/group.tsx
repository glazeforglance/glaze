import { FormNotice } from "../FormNotice.tsx";
import { useWidgetForm } from "../use-widget-form.ts";

/**
 * Settings of a group: its tabs are its child widgets, edited on the canvas.
 * @returns The note and the list of tabs.
 */
export function GroupSettings() {
	const { widget } = useWidgetForm();
	return (
		<FormNotice>
			<p>
				Each tab of this group is a widget of its own. Select a tab on the
				canvas to edit it; its title is the tab name.
			</p>
			{widget.children.length > 0 && (
				<ol className="mt-2 list-decimal pl-5 text-text">
					{widget.children.map((child) => (
						<li key={child.id}>{child.title ?? child.type ?? "Widget"}</li>
					))}
				</ol>
			)}
		</FormNotice>
	);
}
