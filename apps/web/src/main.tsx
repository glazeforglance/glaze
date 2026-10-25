import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App.tsx";

const root = document.getElementById("root");
// index.html always has #root; without it nothing can render, so fail loudly.
if (!root) throw new Error("Missing #root element in index.html");

createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
