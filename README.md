<div align="center">

<img src="docs/brand/glaze-logo.svg" alt="Glaze logo" width="96">

# Glaze

**A visual editor for [Glance](https://github.com/glanceapp/glance) dashboards.**
Drag, drop and configure your pages instead of hand-writing YAML.

![Status](https://img.shields.io/badge/status-v0.1-F5B54A)
![License](https://img.shields.io/badge/license-MIT-5BD08F)
![Built with React](https://img.shields.io/badge/React-19-6CB6FF)

</div>

---

## Why Glaze?

Glance is a fast, beautiful self-hosted dashboard, but it is configured entirely through a single `glance.yml` file. That is great for power users and a wall for everyone else.

**Glaze runs next to Glance** and gives you a visual editor on top of that same file:

- **Drag & drop layout:** pages, columns and widgets, following Glance's own layout rules, so what you build is always something Glance can render.
- **Forms instead of YAML:** click a widget and fill in a form. No more guessing option names or fighting indentation.
- **Live preview:** the real Glance, side by side, reloading after you publish.
- **Your YAML stays yours:** Glaze edits `glance.yml` in place and keeps your comments, anchors and ordering intact. You can always switch to the code view or edit the file by hand.
- **Validation before writing:** YAML syntax, Glance's layout rules, unknown options, and `glance config:validate` itself (the Docker image ships Glance).
- **Multiple users** _(planned)_: everyone gets their own login and their own layout.
- **"Edit page" button in Glance** _(planned)_: jump from your dashboard straight into the editor.

## How it works

```
             ┌──────────────┐        reads        ┌───────────────────┐
  you  ───►  │    Glance    │ ◄────────────────── │                   │
             └──────────────┘                     │  shared config    │
             ┌──────────────┐        writes       │  folder           │
  you  ───►  │    Glaze     │ ──────────────────► │  glance.yml       │
             └──────────────┘                     │  assets/          │
                                                  └───────────────────┘
```

Glaze and Glance share the same config folder. Your edits stay a draft in the browser until you press **Publish**: Glaze then validates the config and writes `glance.yml`, and Glance notices the change and reloads automatically. Glance stays your dashboard; Glaze is just the tool you use to shape it.

## Quick start

You need Docker with Compose, and a folder with your `glance.yml` (for example `./config/glance.yml`).

**1. Create a password hash** for the Glaze login:

```bash
docker run --rm -it ghcr.io/klingesean/glaze:latest hash-password
```

Type your password twice (nothing is shown while you type). The output is one line like `scrypt:32768:8:1:…:…`. It contains only letters, digits, `-`, `_` and `:`, so you can paste it anywhere as is: no quotes, no escaping.

**2. Add Glaze next to Glance** in your `compose.yml` (also in [`docker/compose.example.yml`](docker/compose.example.yml)) and paste your hash:

```yaml
services:
  glance:
    image: glanceapp/glance:v0.8.7
    restart: unless-stopped
    volumes:
      - ./config:/app/config
      - ./config/assets:/app/assets # server.assets-path: /app/assets
    ports:
      - "8080:8080"

  glaze:
    image: ghcr.io/klingesean/glaze:latest
    restart: unless-stopped
    # Glaze runs as uid 1000; see "File permissions" below.
    # user: "1000:1000"
    volumes:
      - ./config:/config # the same folder Glance uses
    ports:
      - "8090:8090"
    environment:
      # Fake example: replace it with the output of step 1.
      GLAZE_ADMIN_PASSWORD_HASH: scrypt:32768:8:1:FAKEsaltReplaceMe0000w:FAKEhashRunHashPasswordAndPasteYourOwn00000
      GLAZE_ASSETS_PATH: /config/assets # the folder Glance serves as /assets/
      GLANCE_URL: http://localhost:8080 # where your browser reaches Glance
```

**3. Start it and log in:**

```bash
docker compose up -d
```

Open <http://localhost:8090> and log in as `admin` with the password from step 1. Make a change, press **Publish** (or `Ctrl/Cmd + S`), and Glance reloads with it.

> [!IMPORTANT]
> Glaze can change your dashboard config, including API keys. Keep it behind its login, and don't expose it to the internet without extra protection. See [Security](#security).

## Password

Glaze has one admin account. There are three ways to give it a password; pick one:

| Option | When |
| --- | --- |
| `GLAZE_ADMIN_PASSWORD_HASH` (**recommended**) | The hash from `hash-password`. The password itself is never stored anywhere. |
| `GLAZE_ADMIN_PASSWORD` | The password in plain text. Works, but Glaze logs a warning at startup, and the password sits in your compose file. The hash wins if both are set. |
| `GLAZE_ADMIN_PASSWORD_HASH_FILE` or `GLAZE_ADMIN_PASSWORD_FILE` | The path to a file holding the hash or password, e.g. a [Docker secret](https://docs.docker.com/compose/how-tos/use-secrets/) in `/run/secrets/`. Whitespace and newlines around the value are ignored. |

Setting both a variable and its `_FILE` variant is an error, so it's always clear which one counts. `GLAZE_SECRET_FILE` works the same way for `GLAZE_SECRET`.

> [!NOTE]
> **Upgrading from v0.1.0?** Its hashes look like `scrypt$32768$8$1$…$…`. Docker Compose reads every `$name` as a variable and replaces it with nothing, so the hash arrives broken (Glaze then says _"Looks like `$` signs were removed"_). Such a hash still works if it reaches Glaze intact, for example in single quotes in an `env_file`, or with every `$` written as `$$`. Simpler: run `hash-password` again (v0.1.1+) and use the new hash, which contains no `$`. Some app installers, such as ZimaOS and CasaOS, turn `$$` back into `$`; there regenerating is the only option.

## ZimaOS / CasaOS

ZimaOS and CasaOS install apps from a compose file and re-serialise it, so values must be free of `$` signs (the v0.1.1+ hash is). If Glance keeps its config in `/DATA/AppData/glance/config` and uses `server.assets-path: /assets` (served from `/DATA/AppData/glance/config/assets` on the host), add Glaze as a **custom app** via **Import → Docker Compose**:

```yaml
name: glaze
services:
  glaze:
    image: ghcr.io/klingesean/glaze:latest
    container_name: glaze
    restart: unless-stopped
    # The AppData folders belong to root on ZimaOS/CasaOS.
    user: "0:0"
    ports:
      - "8090:8090"
    volumes:
      - type: bind
        source: /DATA/AppData/glance/config
        target: /config
    environment:
      # Fake example: run `docker run --rm -it ghcr.io/klingesean/glaze:latest hash-password`
      # in the ZimaOS/CasaOS terminal and paste your own hash here.
      GLAZE_ADMIN_PASSWORD_HASH: scrypt:32768:8:1:FAKEsaltReplaceMe0000w:FAKEhashRunHashPasswordAndPasteYourOwn00000
      # Glance serves this folder as /assets/; inside Glaze it's here.
      GLAZE_ASSETS_PATH: /config/assets
      # Where your browser reaches Glance (your device's IP and Glance's port).
      GLANCE_URL: http://192.168.1.10:8080
x-casaos:
  architectures:
    - amd64
    - arm64
  main: glaze
  icon: https://raw.githubusercontent.com/KlingeSean/glaze-for-glance/main/docs/brand/glaze-logo-512.png
  title:
    en_us: Glaze
  description:
    en_us: A visual editor for Glance dashboards
  port_map: "8090"
```

Adjust the host path and `GLANCE_URL` to your setup. `user: "0:0"` runs Glaze as root, because root owns the AppData folders; the alternative is `chown -R 1000:1000 /DATA/AppData/glance/config` and leaving `user:` out (see [File permissions](#file-permissions)).

## Configuration

Glaze is configured with environment variables. In Docker, the image already sets `NODE_ENV`, `GLAZE_CONFIG_PATH`, `GLANCE_BIN` and `GLAZE_PORT`.

| Variable                    | Default                                          | What it does                                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GLAZE_ADMIN_USERNAME`      | `admin`                                          | Username for the login.                                                                                                                                                                                                  |
| `GLAZE_ADMIN_PASSWORD_HASH` | _(none)_ | **Preferred.** The password as a scrypt hash (`scrypt:N:r:p:salt:hash`), made with `hash-password`. v0.1.0 hashes (`scrypt$…`) still work if they arrive intact. Glaze refuses to start without a password. |
| `GLAZE_ADMIN_PASSWORD`      | _(none)_                                         | The password in plain text. Works, but logs a warning at startup; use the hash instead. When both are set, the hash wins.                                                                                                |
| `GLAZE_SECRET`              | _(generated)_                                    | Signs the session cookies (at least 32 characters). When unset, Glaze generates one on first start and keeps it in `<config folder>/.glaze/secret` (mode 0600), so you stay logged in across restarts.                   |
| `GLAZE_TRUST_PROXY`         | `false`                                          | `true` when Glaze runs behind a reverse proxy or Cloudflare Tunnel: the client IP for the login rate limit comes from `CF-Connecting-IP` / `X-Forwarded-For`, and HTTPS (for `Secure` cookies) from `X-Forwarded-Proto`. |
| `GLAZE_ADMIN_PASSWORD_HASH_FILE`, `GLAZE_ADMIN_PASSWORD_FILE`, `GLAZE_SECRET_FILE` | _(none)_ | Read that value from a file instead (Docker secrets), trimmed. Setting both `X` and `X_FILE` is an error. See [Password](#password). |
| `GLAZE_AUTH`                | `on`                                             | `off` disables the login. **Development only**: Glaze refuses to start with `off` when `NODE_ENV=production` (always the case in Docker).                                                                                |
| `GLAZE_CONFIG_PATH`         | `.dev/glance.yml` (Docker: `/config/glance.yml`) | The `glance.yml` Glaze edits. Relative paths start at the repository root.                                                                                                                                               |
| `GLAZE_PORT`                | `8090`                                           | Port Glaze listens on.                                                                                                                                                                                                   |
| `GLANCE_BIN`                | _(off)_ (Docker: the bundled Glance)             | Path to the Glance binary. When set, every draft is also checked with `glance config:validate`, so Glance's own errors show up in the code view.                                                                         |
| `GLANCE_URL`                | _(off)_                                          | Where your **browser** reaches Glance, e.g. `http://localhost:8080`. Turns on the live preview; its origin is the only one the page may frame.                                                                           |
| `GLAZE_ASSETS_PATH` | _(none)_ | The folder **inside the Glaze container** that holds the files Glance serves under `/assets/`. Needed in Docker, see [Asset files](#asset-files). |
| `GLAZE_WEB_DIST`            | `apps/web/dist`                                  | Folder with the built web app, served next to the API.                                                                                                                                                                   |

**Validation with Glance (`GLANCE_BIN`).** Glaze writes the draft to a temporary `.glaze-validate-*.yml` next to your config (so `$include` paths work), runs Glance on it with a 10 second timeout, and always deletes it again. `${VAR}` references that aren't set in Glaze's environment get a dummy value, so they don't cause false errors. `${secret:…}` and `${readFileFromEnv:…}` read files where Glance runs, so they are reported as "can't be checked here" instead. Without `GLANCE_BIN`, Glaze still checks YAML syntax, Glance's layout rules and unknown options itself.

**Live preview (`GLANCE_URL`).** The preview is your real Glance in an iframe, so it shows the **published** config: after Publish, Glaze waits for Glance to reload and then refreshes the preview. If your Glance has a login, sign in once inside the preview.

### Asset files

The code view also opens the files your config references under `/assets/`: `theme.custom-css-file` and `<link>` / `<script>` tags in `document.head` (`.css`, `.js` and `.mjs` only).

- **In Docker, set `GLAZE_ASSETS_PATH`.** `server.assets-path` (e.g. `/assets` or `/app/assets`) is a path inside the *Glance* container and means nothing inside Glaze's. Mount the same host folder into Glaze (usually it's already inside the config folder you mount at `/config`) and tell Glaze where it is, e.g. `GLAZE_ASSETS_PATH=/config/assets`. `/assets/custom.css` then opens `/config/assets/custom.css`. The folder must exist and be writable, which Glaze checks at startup.
- **Without it**, Glaze resolves `server.assets-path` from the config's folder and only edits files when that folder lies inside the config's folder, so a config alone can't point Glaze elsewhere on disk.
- **The trade-off:** `GLAZE_ASSETS_PATH` may point anywhere, because you set it yourself. Whatever folder you name becomes editable through Glaze: only the `.css`/`.js`/`.mjs` files the config references, never anything above it (`..` and similar tricks are refused). Point it at the assets folder, nothing broader.

## Security

Anyone who can use Glaze can change your dashboard config, including the API keys in it. So:

- **Keep it behind its login.** Use a long password and `GLAZE_ADMIN_PASSWORD_HASH`. Glaze locks out an IP for a few minutes after 5 failed logins.
- **Don't expose it publicly** without an extra layer in front: [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/), a VPN (WireGuard, Tailscale), or keep it LAN-only. Glance itself can be public; Glaze shouldn't be.
- **Behind a reverse proxy or Cloudflare Tunnel**, set `GLAZE_TRUST_PROXY=true`, so the rate limit sees real client IPs and cookies are marked `Secure` over HTTPS. Leave it off when Glaze is reached directly: then those headers could be faked.
- Sessions are signed cookies (`HttpOnly`, `SameSite=Strict`) that last 14 days. Changing the password logs everyone out.
- Prefer `${ENV_VAR}` references in `glance.yml` over plain-text keys.

Found a vulnerability? Please report it privately, see [SECURITY.md](SECURITY.md).

## File permissions

The Glaze image runs as the non-root user `node` (**uid 1000, gid 1000**). It must be able to read and write `glance.yml` **and** its folder: Glaze writes a temp file next to `glance.yml` and renames it over the original (so Glance never sees a half-written file), and keeps its session secret in `.glaze/`.

- **Mount the folder, not the single file** (`./config:/config`). A single bind-mounted file can't be replaced by a rename; Glaze then falls back to writing it in place, but can't create `.glaze/`.
- If your config folder belongs to another user, either give it to uid 1000 (`sudo chown -R 1000:1000 ./config`) or run Glaze as the folder's owner with `user: "UID:GID"` in your compose file.
- Glaze checks this at startup and exits with a message like _"Glaze runs as uid 1000 (gid 1000) but can't write the config file /config/glance.yml, which is owned by uid 0 (gid 0)"_ instead of failing on your first Publish.
- Don't point Glance's `server.assets-path` at the config folder itself, so `.glaze/` is never served.

## Updating

```bash
docker compose pull glaze
docker compose up -d glaze
```

Your config and login stay as they are; they live in your config folder and compose file. See the [changelog](CHANGELOG.md) for what changed.

## Roadmap

- [x] **Phase 0:** project setup (monorepo, React app, API server)
- [x] **Phase 1:** read and write `glance.yml` without losing comments
- [x] **Phase 2:** drag & drop editor for pages, columns and widgets
- [x] **Phase 3:** widget forms for the 10 most used widgets
- [x] **Phase 4:** code view, live preview and validation
- [x] **Phase 5:** login and Docker image → **v0.1 release**
- [ ] Later: theme editor, "Edit page" button, forms for every widget, multiple users

## Tech stack

| Part               | Tech                                                              |
| ------------------ | ----------------------------------------------------------------- |
| Frontend           | React 19, TypeScript, Vite, Tailwind CSS                          |
| Drag & drop        | dnd-kit                                                           |
| State              | Zustand                                                           |
| Forms & validation | React Hook Form + Zod                                             |
| Code editor        | CodeMirror 6                                                      |
| YAML               | [`yaml`](https://eemeli.org/yaml/) (Document API, keeps comments) |
| Server             | Node.js + Hono, bundled with esbuild                              |
| Tooling            | pnpm workspaces, Biome, Oxlint, Vitest                            |

## Development

### Requirements

- [Node.js](https://nodejs.org/) 24 LTS or newer
- [pnpm](https://pnpm.io/) (enable it with `corepack enable pnpm`)
- A running Glance instance for the live preview (optional at first)

### Getting started

```bash
git clone https://github.com/klingesean/glaze-for-glance.git
cd glaze-for-glance
pnpm install
cp .env.example .env
pnpm --filter server hash-password
```

Put the hash in `.env` as `GLAZE_ADMIN_PASSWORD_HASH='…'` (or set `GLAZE_AUTH=off` while developing), point `GLAZE_CONFIG_PATH` at a `glance.yml`, then:

```bash
pnpm dev
```

`pnpm dev` starts the web app (Vite, <http://localhost:5173>) and the API server; Vite proxies `/api` to the server. Everything in `.env` is described in [`.env.example`](.env.example) and under [Configuration](#configuration).

To run the production build on one port:

```bash
pnpm build
pnpm --filter server start
```

To build and smoke-test the Docker image (needs Docker):

```bash
docker build -f docker/Dockerfile -t glaze:smoke .
sh docker/smoke-test.sh glaze:smoke
```

### Keyboard shortcuts

| Keys                     | Action                       |
| ------------------------ | ---------------------------- |
| `Ctrl/Cmd + S`           | Review and publish           |
| `Ctrl/Cmd + 1 / 2 / 3`   | Design / Code / Preview view |
| `Ctrl/Cmd + F` (in code) | Search in the file           |

### Project structure

```
glaze-for-glance/
├─ apps/
│  ├─ web/        # React app (Vite)
│  └─ server/     # API server (Hono): auth, reads and writes glance.yml
├─ packages/
│  └─ core/       # shared types and the YAML document model
├─ docker/        # Dockerfile, compose example, smoke test
├─ docs/          # design document
├─ package.json
└─ pnpm-workspace.yaml
```

## Contributing

Ideas, bug reports and pull requests are very welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the setup and conventions, or open an issue with your use case or the widgets you'd most like to see supported next.

## License

[MIT](LICENSE) © 2026 Sean Klinge

---

<sub>Glaze is a community project and is not affiliated with or endorsed by the Glance project. Glance is licensed under AGPL-3.0; Glaze does not contain Glance code and only reads and writes its configuration format. The Docker image ships the unmodified Glance binary (v0.8.7, AGPL-3.0, source at [glanceapp/glance](https://github.com/glanceapp/glance)) to run `glance config:validate`.</sub>
