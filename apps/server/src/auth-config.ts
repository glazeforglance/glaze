import { createHmac } from "node:crypto";
import { ok, type Result } from "@glaze/core";
import type { AuthConfig } from "./auth.ts";
import type { AuthEnv } from "./env.ts";
import { DEFAULT_SCRYPT_PARAMS, hashPassword } from "./password.ts";
import { loadOrCreateSecret } from "./secret.ts";

/**
 * Turns the auth settings from the environment into what the app needs:
 * the secret (from `GLAZE_SECRET` or `<configDir>/.glaze/secret`) and a
 * password hash. A plain `GLAZE_ADMIN_PASSWORD` is hashed here with a salt
 * derived from the secret, so the hash (and with it every session's
 * `pwdTag`) stays the same across restarts.
 * @param auth - From `readServerEnv`.
 * @param configDir - Folder of `glance.yml`, where `.glaze/secret` lives.
 * @returns The config, `null` when auth is off, or why the secret is unavailable.
 */
export async function resolveAuthConfig(
	auth: AuthEnv,
	configDir: string,
): Promise<Result<AuthConfig | null, string>> {
	if (auth.mode === "off") return ok(null);
	let secret = auth.secret;
	if (secret === null) {
		const stored = await loadOrCreateSecret(configDir);
		if (!stored.ok) return stored;
		secret = stored.value;
	}
	let passwordHash = auth.passwordHash;
	if (passwordHash === null) {
		const salt = createHmac("sha256", secret)
			.update("glaze-plain-password-salt")
			.digest()
			.subarray(0, 16);
		passwordHash = await hashPassword(
			auth.plainPassword ?? "",
			DEFAULT_SCRYPT_PARAMS,
			salt,
		);
	}
	return ok({ username: auth.username, passwordHash, secret });
}
