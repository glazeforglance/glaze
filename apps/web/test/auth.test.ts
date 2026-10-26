import { err, ok, type Result } from "@glaze/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type ApiError,
	fetchSession,
	type LoginError,
	login,
	putConfig,
	type Session,
	setUnauthorizedHandler,
	validateConfig,
} from "../src/lib/api.ts";
import { createAuthStore } from "../src/store/auth-store.ts";

function json(status: number, body: unknown, headers: HeadersInit = {}) {
	return new Response(JSON.stringify(body), { status, headers });
}

afterEach(() => {
	setUnauthorizedHandler(null);
	vi.unstubAllGlobals();
});

describe("401 handling in the API layer", () => {
	it("waits for a new login and then retries the same request", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(json(401, { error: "unauthorized" }))
			.mockResolvedValueOnce(json(200, { version: "v2", issues: [] }));
		vi.stubGlobal("fetch", fetchMock);
		let relogin: () => void = () => {};
		const handler = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					relogin = resolve;
				}),
		);
		setUnauthorizedHandler(handler);

		const pending = putConfig("pages: []\n", "v1");
		await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
		expect(fetchMock).toHaveBeenCalledTimes(1);
		relogin();

		expect(await pending).toEqual({
			ok: true,
			value: { version: "v2", issues: [] },
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
		// The retry sends exactly the same body, so the publish isn't lost.
		const [first, second] = fetchMock.mock.calls;
		expect(second?.[1]?.body).toBe(first?.[1]?.body);
	});

	it("also retries JSON requests such as validation", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn<typeof fetch>()
				.mockResolvedValueOnce(json(401, {}))
				.mockResolvedValueOnce(json(200, { issues: [] })),
		);
		setUnauthorizedHandler(async () => {});
		expect(await validateConfig("x")).toEqual({ ok: true, value: [] });
	});

	it("reports a 401 as an error when no handler is set", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => json(401, { message: "Log in to use Glaze" })),
		);
		expect(await validateConfig("x")).toEqual({
			ok: false,
			error: { status: 401, message: "Log in to use Glaze" },
		});
	});
});

describe("auth calls", () => {
	it("reads the session", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				json(200, { authenticated: true, user: "admin", authDisabled: false }),
			),
		);
		expect(await fetchSession()).toEqual({
			ok: true,
			value: { authenticated: true, user: "admin", authDisabled: false },
		});
	});

	it("never shows the overlay for a wrong password", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => json(401, {})),
		);
		const handler = vi.fn(async () => {});
		setUnauthorizedHandler(handler);
		const result = await login("admin", "nope");
		expect(result).toMatchObject({ ok: false, error: { kind: "invalid" } });
		expect(handler).not.toHaveBeenCalled();
	});

	it("explains a rate limit with the minutes to wait", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => json(429, {}, { "Retry-After": "250" })),
		);
		expect(await login("admin", "x")).toEqual({
			ok: false,
			error: {
				kind: "rate-limited",
				retryAfter: 250,
				message: "Too many failed attempts. Try again in 5 minutes.",
			},
		});
	});
});

describe("auth store", () => {
	const signedIn: Session = {
		authenticated: true,
		user: "admin",
		authDisabled: false,
	};

	function store() {
		const api = {
			fetchSession: vi.fn(
				async (): Promise<Result<Session, ApiError>> => ok(signedIn),
			),
			login: vi.fn(
				async (
					_username: string,
					_password: string,
				): Promise<Result<Session, LoginError>> => ok(signedIn),
			),
			logout: vi.fn(async (): Promise<Result<void, ApiError>> => ok(undefined)),
		};
		return { api, auth: createAuthStore(api) };
	}

	it("checks the session on startup", async () => {
		const { auth } = store();
		expect(auth.getState().status).toBe("checking");
		await auth.getState().check();
		expect(auth.getState()).toMatchObject({
			status: "signed-in",
			user: "admin",
		});
	});

	it("shows an error when the server can't be reached", async () => {
		const { api, auth } = store();
		api.fetchSession.mockResolvedValueOnce(
			err({ status: null, message: "down" }),
		);
		await auth.getState().check();
		expect(auth.getState()).toMatchObject({ status: "error", error: "down" });
	});

	it("overlays the login mid-session and resumes every waiting request", async () => {
		const { auth } = store();
		await auth.getState().check();
		const done = vi.fn();
		void auth.getState().requireLogin().then(done);
		void auth.getState().requireLogin().then(done);
		expect(auth.getState().reauth).toBe(true);
		// The editor stays: still signed in underneath the overlay.
		expect(auth.getState().status).toBe("signed-in");

		await auth.getState().logIn("admin", "pw");
		await vi.waitFor(() => expect(done).toHaveBeenCalledTimes(2));
		expect(auth.getState().reauth).toBe(false);
	});

	it("keeps the overlay and the waiting requests after a wrong password", async () => {
		const { api, auth } = store();
		await auth.getState().check();
		const done = vi.fn();
		void auth.getState().requireLogin().then(done);
		api.login.mockResolvedValueOnce(
			err({ kind: "invalid", message: "Wrong username or password." }),
		);
		const result = await auth.getState().logIn("admin", "nope");
		expect(result.ok).toBe(false);
		expect(auth.getState().reauth).toBe(true);
		expect(done).not.toHaveBeenCalled();
	});

	it("logs out to the login screen", async () => {
		const { api, auth } = store();
		await auth.getState().check();
		await auth.getState().logOut();
		expect(api.logout).toHaveBeenCalled();
		expect(auth.getState().status).toBe("signed-out");
	});
});
