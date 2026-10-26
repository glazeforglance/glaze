import { useEffect, useState } from "react";
import { fetchSettings, type Settings } from "../lib/api.ts";

/** Server settings, or why they couldn't be loaded. */
export type SettingsState =
	| { readonly status: "loading" }
	| { readonly status: "ready"; readonly settings: Settings }
	| { readonly status: "error"; readonly message: string };

// Settings come from env vars and don't change while Glaze runs: load them once.
let cached: Promise<SettingsState> | null = null;

function loadSettings(): Promise<SettingsState> {
	cached ??= fetchSettings().then(
		(result): SettingsState =>
			result.ok
				? { status: "ready", settings: result.value }
				: { status: "error", message: result.error.message },
	);
	return cached;
}

/**
 * Loads `/api/settings` once per page load and shares the result.
 * @returns The settings state.
 */
export function useSettings(): SettingsState {
	const [state, setState] = useState<SettingsState>({ status: "loading" });
	useEffect(() => {
		let active = true;
		void loadSettings().then((next) => {
			if (active) setState(next);
		});
		return () => {
			active = false;
		};
	}, []);
	return state;
}
