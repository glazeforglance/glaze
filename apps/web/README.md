# web

Glaze's editor: a React 19 app built with Vite, TypeScript and Tailwind CSS v4.

```bash
pnpm --filter web dev        # http://localhost:5173, proxies /api to the server on port 8090
pnpm --filter web build      # type check + production build into dist/
pnpm --filter web test       # Vitest
pnpm --filter web typecheck
pnpm --filter web lint       # Oxlint
```

Run `pnpm dev` from the repository root to start the web app and the API server together. In production, the server serves `dist/` next to the API (`GLAZE_WEB_DIST`).

| Folder            | What's in it                                                                       |
| ----------------- | ---------------------------------------------------------------------------------- |
| `src/components/` | The UI: top bar, canvas, library, inspector, code view, preview, settings, login   |
| `src/forms/`      | The schema-driven forms (`SchemaForm`) and their field components                  |
| `src/store/`      | Zustand stores: the editor draft, asset files and the login state                  |
| `src/hooks/`      | Loading, publishing, validation, shortcuts, drag & drop and code sync              |
| `src/lib/`        | Pure helpers: drop geometry, widths, the widget catalog, CodeMirror setup, the API |
| `test/`           | Vitest tests                                                                       |

Every edit goes through `@glaze/core`, so the YAML keeps its comments and ordering. See [docs/development.md](../../docs/development.md) for the full setup and [docs/usage.md](../../docs/usage.md) for what the app does.
