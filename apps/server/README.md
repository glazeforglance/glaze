# server

Glaze's API: a small [Hono](https://hono.dev/) server on Node. It reads, validates and writes `glance.yml` and its asset files, handles the admin login, and in production also serves the built web app. Default port: 8090.

```bash
pnpm --filter server dev            # tsx watch, reads .env from the repository root
pnpm --filter server build          # esbuild bundle into dist/
pnpm --filter server start          # run the bundle (after pnpm build)
pnpm --filter server test           # Vitest
pnpm --filter server typecheck
pnpm --filter server hash-password  # make a GLAZE_ADMIN_PASSWORD_HASH
```

| Route                                  | What it does                                                                |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `GET /api/healthz`                     | Health check with the version (no login needed)                             |
| `/api/auth/login`, `/logout`, `/session` | The admin login (signed session cookie)                                   |
| `GET /api/config`, `PUT /api/config`   | Read `glance.yml`; validate and publish a new version                       |
| `POST /api/validate`                   | Check a draft: YAML, layout rules, options and `glance config:validate`     |
| `GET /api/files`, `GET`/`PUT /api/files/:name` | List, read and publish the asset files the config references (`.css`, `.js`, `.mjs`) |
| `GET /api/settings`                    | The Glance URL for the preview, and whether Glance validation is on         |
| `POST /api/glance/password-hash`       | Hash a password for one of Glance's users                                   |

All settings are environment variables, listed in [docs/configuration.md](../../docs/configuration.md). File system and network side effects live here, never in `@glaze/core`. Security notes: [docs/security.md](../../docs/security.md) and [DESIGN.md §9](../../docs/DESIGN.md#9-security).
