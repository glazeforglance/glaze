<div align="center">

# Glaze

**A visual editor for [Glance](https://github.com/glanceapp/glance) dashboards.**
Drag, drop and configure your pages instead of hand-writing YAML.

![Status](https://img.shields.io/badge/status-early%20development-F5B54A)
![License](https://img.shields.io/badge/license-MIT-5BD08F)
![Built with React](https://img.shields.io/badge/React-19-6CB6FF)

</div>

> [!WARNING]
> Glaze is in **early development** and not usable yet. Star or watch the repo to follow along.

---

## Why Glaze?

Glance is a fast, beautiful self-hosted dashboard, but it is configured entirely through a single `glance.yml` file. That is great for power users and a wall for everyone else.

**Glaze runs next to Glance** and gives you a visual editor on top of that same file:

- **Drag & drop layout:** pages, columns and widgets, following Glance's own layout rules, so what you build is always something Glance can render.
- **Forms instead of YAML:** click a widget and fill in a form. No more guessing option names or fighting indentation.
- **Live preview:** the real Glance, side by side, reloading as you edit.
- **Your YAML stays yours:** Glaze edits `glance.yml` in place and keeps your comments, anchors and ordering intact. You can always switch to the code view or edit the file by hand.
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

Glaze and Glance share the same config folder. Glaze writes `glance.yml`, and Glance notices the change and reloads automatically. Glance stays your dashboard; Glaze is just the tool you use to shape it.

## Quick start

> Coming with the first release. Glaze will ship as a single Docker image that you run next to your existing Glance container.

```yaml
# docker-compose.yml (preview, not published yet)
services:
  glaze:
    image: ghcr.io/YOUR_GITHUB_USERNAME/glaze:latest
    ports:
      - "8090:8090"
    volumes:
      - ./glance-config:/config # the same folder your Glance container uses
    environment:
      GLAZE_ADMIN_PASSWORD: change-me
```

> [!IMPORTANT]
> Glaze can change your dashboard config, including API keys. Always keep it behind its login, and don't expose it to the internet without extra protection (for example Cloudflare Access or a VPN).

## Roadmap

- [x] **Phase 0:** project setup (monorepo, React app, API server)
- [x] **Phase 1:** read and write `glance.yml` without losing comments
- [ ] **Phase 2:** drag & drop editor for pages, columns and widgets
- [ ] **Phase 3:** widget forms for the 10 most used widgets
- [ ] **Phase 4:** code view, live preview and validation
- [ ] **Phase 5:** login and Docker image → **v0.1 release**
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
| Server             | Node.js + Hono                                                    |
| Tooling            | pnpm workspaces, Biome, Vitest                                    |

## Development

### Requirements

- [Node.js](https://nodejs.org/) 24 LTS or newer
- [pnpm](https://pnpm.io/) (enable it with `corepack enable pnpm`)
- A running Glance instance for the live preview (optional at first)

### Getting started

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/glaze-for-glance.git
cd glaze-for-glance
pnpm install
pnpm dev
```

`pnpm dev` starts both the web app and the API server.

### Project structure

```
glaze-for-glance/
├─ apps/
│  ├─ web/        # React app (Vite)
│  └─ server/     # API server (Hono) that reads and writes glance.yml
├─ packages/
│  └─ core/       # shared types and the YAML document model
├─ package.json
└─ pnpm-workspace.yaml
```

## Contributing

Ideas, bug reports and pull requests are very welcome. Glaze is in an early stage, so the best way to help right now is to open an issue with your use case or the widgets you'd most like to see supported first.

## License

[MIT](LICENSE) © 2026 Sean Klinge

---

<sub>Glaze is a community project and is not affiliated with or endorsed by the Glance project. Glance is licensed under AGPL-3.0; Glaze does not contain Glance code and only reads and writes its configuration format.</sub>
