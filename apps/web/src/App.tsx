import { Canvas } from "./components/canvas/Canvas.tsx";
import { CodeWorkspace } from "./components/code/CodeWorkspace.tsx";
import { EditorDndContext } from "./components/dnd/EditorDndContext.tsx";
import { Inspector } from "./components/inspector/Inspector.tsx";
import { PreviewPane } from "./components/preview/PreviewPane.tsx";
import { WidgetLibrary } from "./components/library/WidgetLibrary.tsx";
import { TopBar } from "./components/top-bar/TopBar.tsx";
import { GlazeMark } from "./components/ui/icons.tsx";
import { useLoadConfig } from "./hooks/use-load-config.ts";
import { useOnceTrue } from "./hooks/use-once-true.ts";
import { useShortcuts } from "./hooks/use-shortcuts.ts";
import { useEditor } from "./store/editor-store.ts";

/**
 * The Glaze editor: loads the config, then shows top bar, library, canvas and inspector.
 * @returns The app.
 */
export function App() {
	useLoadConfig();
	useShortcuts();
	const status = useEditor((state) => state.status);
	const error = useEditor((state) => state.error);
	const view = useEditor((state) => state.view);
	// Mounted on first use, then only hidden, so the editor keeps its cursor.
	const codeMounted = useOnceTrue(view === "code");

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
				{codeMounted && <CodeWorkspace active={view === "code"} />}
				{view === "preview" && <PreviewPane />}
				{view === "design" && (
					<>
						<EditorDndContext>
							<WidgetLibrary />
							<Canvas />
						</EditorDndContext>
						<Inspector />
					</>
				)}
			</div>
		</div>
	);
}
