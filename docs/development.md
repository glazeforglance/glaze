# Development

## Requirements

- [Node.js](https://nodejs.org/) 24 LTS or newer
- [pnpm](https://pnpm.io/) (enable it with `corepack enable pnpm`)
- A running Glance instance for the live preview (optional at first)

## Getting started

```bash
git clone https://github.com/glazeforglance/glaze.git
cd glaze
pnpm install
cp .env.example .env
pnpm --filter server hash-password
```

Put the hash in `.env` as `GLAZE_ADMIN_PASSWORD_HASH='…'` (or set `GLAZE_AUTH=off` while developing), point `GLAZE_CONFIG_PATH` at a `glance.yml`, then:

```bash
pnpm dev
```

`pnpm dev` starts the web app (Vite, <http://localhost:5173>) and the API server; Vite proxies `/api` to the server. Everything in `.env` is described in [`.env.example`](../.env.example) and under [Configuration](configuration.md).

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

## Keyboard shortcuts

| Keys                       | Action                                  |
| -------------------------- | --------------------------------------- |
| `Ctrl/Cmd + S`             | Review and publish                      |
| `Ctrl/Cmd + 1 / 2 / 3 / 4` | Design / Code / Preview / Settings view |
| `Ctrl/Cmd + F` (in code)   | Search in the file                      |

## Project structure

```
glaze/
├─ apps/
│  ├─ web/        # React app (Vite)
│  └─ server/     # API server (Hono): auth, reads and writes glance.yml
├─ packages/
│  ├─ core/       # shared types and the YAML document model
│  └─ schemas/    # widget, page and config schemas generated from the Glance source
├─ docker/        # Dockerfile, compose example, smoke test
├─ docs/          # design document, guides, screenshots (+ demo config)
├─ scripts/       # schema generator, brand, release and screenshot scripts
├─ package.json
└─ pnpm-workspace.yaml
```

## Widget schemas

Every form comes from `packages/schemas`, generated from the Glance source:

```bash
pnpm schemas                    # download Glance v0.8.7 and regenerate
pnpm schemas --source ../glance # use a local Glance checkout
pnpm schemas --check            # CI: fail when the committed files are stale
```

Labels, help texts, enums the code doesn't spell out and the options a new widget starts with live in [`packages/schemas/overrides.ts`](../packages/schemas/overrides.ts); never edit `src/generated/` by hand. The generator fails when an override no longer matches Glance, so a new Glance version shows up as a clear list of things to update. See [DESIGN.md §8](DESIGN.md) for how it works.

To run the integration test against Glance itself (CI does this with v0.8.7), point `GLANCE_BIN` at a Glance binary:

```bash
GLANCE_BIN=/path/to/glance pnpm --filter server test
```

## Screenshots

The images in [`docs/screenshots/`](screenshots/) come from `pnpm screenshots`. It starts the production build with the demo config in [`docs/screenshots/demo/glance.yml`](screenshots/demo/glance.yml) (auth off, on a free port), drives it with Playwright and writes the PNGs. All edits happen in the browser; the demo config is copied to a temp folder first.

```bash
pnpm exec playwright install chromium   # once
pnpm build
pnpm screenshots
```

The live preview shot (`code-preview.png`) needs Glance: set `GLANCE_BIN` to a Glance v0.8.7 binary and keep port 8080 free. Without it, that shot is skipped. Re-run `pnpm screenshots` when the UI changed.

## Tech stack

| Part               | Tech                                                              |
| ------------------ | ----------------------------------------------------------------- |
| Frontend           | React 19, TypeScript, Vite, Tailwind CSS                          |
| Drag & drop        | dnd-kit                                                           |
| State              | Zustand                                                           |
| Forms & validation | React Hook Form + Zod, generated from `@glaze/schemas`            |
| Code editor        | CodeMirror 6                                                      |
| YAML               | [`yaml`](https://eemeli.org/yaml/) (Document API, keeps comments) |
| Server             | Node.js + Hono, bundled with esbuild                              |
| Tooling            | pnpm workspaces, Biome, Oxlint, Vitest                            |
