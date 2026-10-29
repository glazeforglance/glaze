import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App.tsx";
import { initI18n } from "./i18n.ts";

const root = document.getElementById("root");
// index.html always has #root; without it nothing can render, so fail loudly.
if (!root) throw new Error("Missing #root element in index.html");

const container = root;
// The detected language loads before the first render, so nothing flashes in English.
void initI18n().finally(() => {
	createRoot(container).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
});
