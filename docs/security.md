# Security

Anyone who can use Glaze can change your dashboard config, including the API keys in it. So:

- **Keep it behind its login.** Use a long password and `GLAZE_ADMIN_PASSWORD_HASH`. Glaze locks out an IP for a few minutes after 5 failed logins.
- **Don't expose it publicly** without an extra layer in front: [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/), a VPN (WireGuard, Tailscale), or keep it LAN-only. Glance itself can be public; Glaze shouldn't be.
- **Behind a reverse proxy or Cloudflare Tunnel**, set `GLAZE_TRUST_PROXY=true`, so the rate limit sees real client IPs and cookies are marked `Secure` over HTTPS. Leave it off when Glaze is reached directly: then those headers could be faked.
- Sessions are signed cookies (`HttpOnly`, `SameSite=Strict`) that last 14 days. Changing the password logs everyone out.
- Prefer `${ENV_VAR}` references in `glance.yml` over plain-text keys.

Found a vulnerability? Please report it privately, see [SECURITY.md](../SECURITY.md).
