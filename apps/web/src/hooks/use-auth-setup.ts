import { useEffect } from "react";
import { setUnauthorizedHandler } from "../lib/api.ts";
import { authStore } from "../store/auth-store.ts";

/**
 * Checks the session once on startup and routes every 401 from the API to
 * the auth store, which shows the login overlay and lets the request retry.
 */
export function useAuthSetup(): void {
	useEffect(() => {
		setUnauthorizedHandler(() => authStore.getState().requireLogin());
		void authStore.getState().check();
		return () => setUnauthorizedHandler(null);
	}, []);
}
