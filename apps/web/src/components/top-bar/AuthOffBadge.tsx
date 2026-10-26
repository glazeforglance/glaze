import { GLAZE_VERSION } from "../../lib/version.ts";
import { useAuth } from "../../store/auth-store.ts";

/**
 * A small amber badge while the server runs with `GLAZE_AUTH=off`, so it's
 * hard to forget that anyone who can reach Glaze can change the config.
 * @returns The badge, or nothing when auth is on.
 */
export function AuthOffBadge() {
	const authDisabled = useAuth((state) => state.authDisabled);
	if (!authDisabled) return null;
	return (
		<span
			title={`Glaze v${GLAZE_VERSION}: GLAZE_AUTH=off, anyone who can reach Glaze can edit the config. Development only.`}
			className="rounded-[6px] border border-accent/40 bg-accent/12 px-1.5 py-0.5 font-mono text-[11px] text-accent"
		>
			Auth off (dev)
		</span>
	);
}
