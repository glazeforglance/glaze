import { Canvas } from "./components/canvas/Canvas.tsx";
import { EditorDndContext } from "./components/dnd/EditorDndContext.tsx";
import { Inspector } from "./components/inspector/Inspector.tsx";
import { WidgetLibrary } from "./components/library/WidgetLibrary.tsx";
import { TopBar } from "./components/top-bar/TopBar.tsx";
import { GlazeMark } from "./components/ui/icons.tsx";
import { useLoadConfig } from "./hooks/use-load-config.ts";
import { useEditor } from "./store/editor-store.ts";

/**
 * The Glaze editor: loads the config, then shows top bar, library, canvas and inspector.
 * @returns The app.
 */
export function App() {
	useLoadConfig();
	const status = useEditor((state) => state.status);
	const error = useEditor((state) => state.error);

	if (status !== "ready") {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
				<GlazeMark className="size-10 text-accent" />
				{status === "loading" ? (
					<p role="status" className="text-muted">
						Loading glance.yml…
					</p>
				) : (
					<div role="alert" className="max-w-xl">
						<p className="font-semibold">Couldn't open the config</p>
						<p className="mt-1 font-mono text-sm text-danger">{error}</p>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<TopBar />
			<div className="flex min-h-0 flex-1">
				<EditorDndContext>
					<WidgetLibrary />
					<Canvas />
				</EditorDndContext>
				<Inspector />
			</div>
		</div>
	);
}
