/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

// The app version comes from the root package.json (the one that's tagged).
const rootPackage = JSON.parse(
	readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	define: {
		__GLAZE_VERSION__: JSON.stringify(rootPackage.version),
	},
	test: {
		// Starts i18next in English, so code under test gets real sentences.
		setupFiles: ["./test/setup.ts"],
	},
	server: {
		// The Glaze API (apps/server); see GLAZE_PORT in .env.example.
		proxy: { "/api": "http://localhost:8090" },
	},
});
