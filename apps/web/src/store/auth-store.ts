import { err, ok, type Result } from "@glaze/core";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
	fetchSession,
	type LoginError,
	login,
	logout,
	type Session,
} from "../lib/api.ts";

/** Where the login is at. */
export type AuthStatus =
	/** Asking the server on startup. */
	| "checking"
	| "signed-in"
	| "signed-out"
	/** The server couldn't be asked; `error` says why. */
	| "error";

/** Login state shared by the app, the top bar and the login screen. */
export interface AuthState {
	readonly status: AuthStatus;
	readonly user: string | null;
	/** The server runs with `GLAZE_AUTH=off`. */
	readonly authDisabled: boolean;
	readonly error: string | null;
	/**
	 * The session ended while the editor was open (an API call got 401).
	 * The login overlay is shown on top of the editor, which stays as it is.
	 */
	readonly reauth: boolean;
}

/** What the UI can do with the login. */
export interface AuthActions {
	/** Asks the server for the current session (on startup, or "Try again"). */
	check(): Promise<void>;
	/** Logs in; on success the overlay closes and waiting requests are retried. */
	logIn(username: string, password: string): Promise<Result<void, LoginError>>;
	/** Logs out and shows the login screen. */
	logOut(): Promise<void>;
	/**
	 * Called by the API layer on a 401: shows the overlay and resolves once the
	 * user has logged in again. Several requests can wait at the same time.
	 */
	requireLogin(): Promise<void>;
}

export type AuthStore = AuthState & AuthActions;

/**
 * Creates an auth store. The app uses one shared instance; tests make their own.
 * @param api - The API calls, replaceable in tests.
 * @returns A Zustand store with state and actions.
 */
export function createAuthStore(
	api = { fetchSession, login, logout },
): StoreApi<AuthStore> {
	// Resolvers of requests waiting for a new login.
	let waiting: (() => void)[] = [];

	return createStore<AuthStore>()((set, get) => {
		const apply = (session: Session) =>
			set({
				status: session.authenticated ? "signed-in" : "signed-out",
				user: session.user,
				authDisabled: session.authDisabled,
				error: null,
			});

		return {
			status: "checking",
			user: null,
			authDisabled: false,
			error: null,
			reauth: false,

			check: async () => {
				set({ status: "checking", error: null });
				const result = await api.fetchSession();
				if (result.ok) apply(result.value);
				else set({ status: "error", error: result.error.message });
			},

			logIn: async (username, password) => {
				const result = await api.login(username, password);
				if (!result.ok) return err(result.error);
				apply(result.value);
				set({ reauth: false });
				const resume = waiting;
				waiting = [];
				for (const done of resume) done();
				return ok(undefined);
			},

			logOut: async () => {
				await api.logout();
				// Even if the server can't be reached: the user asked to leave.
				set({ status: "signed-out", reauth: false });
			},

			requireLogin: () =>
				new Promise<void>((resolve) => {
					waiting.push(resolve);
					// On the full login screen there's no editor to keep; only overlay it.
					if (get().status === "signed-in") set({ reauth: true });
				}),
		};
	});
}

/** The app's auth store. */
export const authStore = createAuthStore();

/**
 * Reads from the auth store in a component.
 * @param selector - Picks the part of the state the component needs.
 * @returns The selected value.
 */
export function useAuth<T>(selector: (state: AuthStore) => T): T {
	return useStore(authStore, selector);
}
