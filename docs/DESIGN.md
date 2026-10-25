# Glaze: design document

> Status: in development · phases 0 and 1 done
> Target: Glance **v0.8.7**

---

## 1. Summary

Glance is a self-hosted dashboard that is configured entirely through a single YAML file (`glance.yml`). That is hard for most people. **Glaze** is a visual editor that runs **next to** Glance: you drag pages, columns and widgets into a layout, fill in a form per widget, and Glaze writes `glance.yml` for you. Glance stays the actual dashboard; Glaze is only the tool to edit it.

**Goals**

1. Build and change Glance pages without typing YAML.
2. The YAML stays visible and editable at all times (code view). Comments and ordering are preserved.
3. Multiple users, each with their own login and layout.
4. One click from Glance into the editor (an "Edit page" button).
5. Open source and easy to install as a single Docker container next to Glance.

**Non-goals**

- Becoming a dashboard app of its own (like Homarr or Homepage). Glance stays the dashboard.
- A free-form canvas like Figma. The editor follows Glance's column model (see §4), so you can't design anything Glance can't render.

**Audience:** self-hosters who use (or want to use) Glance and would rather not write YAML by hand. Typically someone with a home server (ZimaOS, Unraid, TrueNAS, plain Docker) behind a reverse proxy or Cloudflare Tunnel.

---

## 2. Design principles

1. **`glance.yml` is the source of truth.** Glaze has no database of its own for layouts. It reads and writes the YAML, so users can always fall back to editing by hand or to Git.
2. **Comments and ordering are preserved.** Editing through the UI must never drop comments, anchors (`&name` / `<<: *name`) or key order.
3. **Follow Glance's model.** Don't offer options Glance doesn't know. Show Glance errors in plain language, with a "Fix" button where possible.
4. **Live preview with real data.** The preview is the real Glance in an iframe, not a re-implementation.
5. **Secure by default.** Glaze can write config and API keys, so it always sits behind a login. Secrets are preferably stored as environment variables (`${SONARR_API_KEY}`), not as plain text.

---

## 3. Name

**Glaze**: a glaze layer on top of Glance. Short, and it sounds almost the same. The repository and package are called `glaze-for-glance` to avoid name clashes; "Glaze" is the product name.

---

## 4. What we know about Glance (verified in the v0.8.7 source)

These facts come from the Glance v0.8.7 source (`github.com/glanceapp/glance`). Re-check them when targeting a new Glance version.

**Config structure**

- Top level: `server`, `auth`, `document`, `branding`, `theme`, `pages`.
- `pages[]`: `name`, `slug`, `width` (`slim` / `wide` / default), `desktop-navigation-width`, `show-mobile-header`, `hide-desktop-navigation`, `center-vertically`, `head-widgets`, `columns`.
- `columns[]`: `size` (`small` | `full`) + `widgets[]`.

**Column rules** (from `config.go`; the editor must enforce these)

- A page has at least 1 column.
- At most **3 columns**; at most **2** when `width: slim`.
- `size` is only `small` or `full`.
- A page has **1 or 2** `full` columns.

**Options every widget has (`widgetBase`)**
`type`, `title`, `title-url`, `hide-header`, `css-class`, `cache`.

**Special widgets**

- `group`: widgets as tabs. No `group` or `split-column` inside it. Children automatically get `hide-header`.
- `split-column`: widgets side by side, with `max-columns` (minimum 2).
- `custom-api`: `url` (optional!), `method`, `headers`, `parameters`, `body`, `body-type`, `skip-json-validation`, `subrequests`, `options`, `template`, `frameless`. Glance waits at most 5 seconds for a response (not configurable). Templates have functions such as `now`, `offsetNow`, `parseTime`, `formatTime`, `sortByTime`, `findSubmatch`, `concat`, `add`/`sub`/`mul`/`div`/`mod` and `.Options.StringOr`.
- `docker-containers`: `containers:` sets labels per container name (icon, description, url…) without touching Docker labels.

**Other capabilities**

- `document.head`: custom HTML/JS in the `<head>`. This is the hook for the "Edit page" button.
- Icon prefixes: `si:` (simple-icons), `di:` (dashboard-icons, `.svg` by default, `.png` possible), `sh:` (selfh.st), `mdi:`.
- Variables in the config: `${ENV_VAR}`, `${secret:name}` (Docker secrets), `${readFileFromEnv:VAR}`.
- Includes: `$include: path/to/file.yml` (also `!include:`). Useful for one file per page.
- **Glance reloads the config automatically** when a file changes (`fsnotify`), so Glaze never needs to restart Glance.
- Glance CLI: `config:validate`, `config:print`, `secret:make`, `password:hash`, `sensors:print`, `mountpoint:info`, `diagnose`.

**Users in Glance**

- `auth.users` with `password` or `password-hash`, plus `auth.secret-key`.
- A login session lasts 14 days and is renewed automatically when Glance is opened during its last 7 days.
- With `server.proxied: true`, brute-force protection (block after 5 failures in 5 minutes) also works behind a proxy.
- **Important limitation:** Glance can't restrict pages per user. Every logged-in user sees everything. See §7 for how Glaze solves this.

---

## 5. Features

### MVP (v0.1)

- Read `glance.yml`, show it as pages → columns → widgets, and write it back with comments preserved.
- Add, rename and remove pages. Add and remove columns, and switch `small`/`full`, within the rules in §4.
- Drag widgets: from the library into a column, and between columns.
- Inspector with forms for the 10 most used widgets: `clock`, `weather`, `calendar`, `search`, `bookmarks`, `monitor`, `rss`, `releases`, `docker-containers`, `group`.
- For other widgets: a "raw YAML" tab in the inspector.
- Code view (YAML editor) + live preview of Glance in an iframe.
- Validation via `glance config:validate`, with errors on the right line.
- Login for Glaze itself (single admin).

### v0.2

- All widgets, with forms generated automatically from the Glance source (§8).
- Theme editor: colors (HSL) with preview, plus presets.
- Library of custom CSS presets (for example a "dark cards" style).
- "Edit page" button in Glance via `document.head`.
- Undo/redo and a version history (`.glaze/history/`).

### v0.3

- Multiple users with their own layout (§7).
- Templates ("Calm", "Homelab", "Media").
- Secrets management: keys as `${VAR}` in a `.env` file, never as plain text in the YAML.

### Later / ideas

- A marketplace of `custom-api` recipes (Sonarr calendar, Immich featured photo, and so on).
- Import from Homarr or Homepage.
- A pull request to Glance for per-page permissions (would simplify §7).

---

## 6. Screens

1. **Editor**
   - Top bar: logo, page tabs (+ Page), Design/Code/Preview switch, user switcher, undo, **Publish**.
   - Left: widget library with search, grouped as Basics / Server / Media & news / Advanced.
   - Center: the page as columns, each with a label (`small` ▾ / `full` ▾). Widget blocks with a drag handle, a dashed drop indicator, and a selection with an amber outline plus duplicate and delete buttons.
   - Right: inspector with Settings / Style / YAML tabs and forms (example: Monitor with a list of sites, each with `url` and `check-url`).
2. **Code + live preview:** the YAML editor on the left with file tabs (`glance.yml`, `custom.css`, `design.js`), syntax highlighting and inline errors ("unknown option `stlye`: did you mean `style`? [Fix]"). Live preview on the right with a desktop/phone toggle. Clicking a widget in the preview jumps to it in the code.
3. **Users:** list of users with role, visible pages and the status of their Glance instance. Detail panel with username, password, a checkbox per page, a starting template and "Edit layout".
4. **Button in Glance:** an "Edit page" pill next to the status label, with a tooltip. Opens Glaze directly on that page.

**Visual style**

- Background `#0B0D11` / `#0E1014`, cards `#161A20`, borders `#232832`, text `#E6E8EC`, muted text `#A3ABB8`.
- Accent amber `#F5B54A`. Status: green `#5BD08F`, orange-red `#FF7A59`, blue `#6CB6FF`, purple `#C792EA`.
- Fonts: **Space Grotesk** (UI) and **JetBrains Mono** (code, values, labels).
- Corner radius 8–14 px. Clickable elements at least 36–44 px tall.

---

## 7. Architecture

```
Browser
  │
  ├── glance.example.com ──► Glance (container)  ◄── reads  ──┐
  │                                                           │
  └── glaze.example.com  ──► Glaze (container)                │
                              ├─ React app (Vite, static)     │
                              └─ Node API (Hono)  ── writes ──┤
                                                              ▼
                                           shared folder /config
                                           ├─ glance.yml
                                           ├─ assets/ (custom.css, design.js, background)
                                           └─ .glaze/ (history, users, settings)
```

- **Glaze container**: one Node process that serves the built React app and a small API.
- **Shared folder**: Glaze and Glance mount the same config folder. Glaze writes; Glance sees the change and reloads.
- **Validation**: Glaze runs `glance config:validate`, either by shipping the Glance binary in the Glaze image (Glance is a single Go binary) or via `docker exec` (requires Docker socket access, which is less secure).
- **Live preview**: an iframe pointing at the Glance URL. For "click a widget → jump to the code", Glaze injects a small script through `document.head` that reports clicks with `postMessage`.

**Multiple users: two routes**

- **Route A (v0.3, works with Glance as it is today):** one Glance instance per user with its own config (`/config/users/<name>/glance.yml`). Glaze manages the containers (Docker API) and acts as the login gate: after logging in, Glaze forwards you to your own instance (reverse proxy by path or subdomain). Downside: Glaze needs access to the Docker socket.
- **Route B (long term):** a pull request to Glance that lets a page list which users may see it (for example `pages[].users: [alice]`). Then a single Glance instance is enough and Glaze only has to write that to the YAML.

---

## 8. Tech stack

| Part         | Choice                                  | Why                                                                               |
| ------------ | --------------------------------------- | --------------------------------------------------------------------------------- |
| Language     | TypeScript (strict)                     | Types catch mistakes in the config structure.                                     |
| Frontend     | React 19 + Vite                         | Fast to develop; Vite produces a static build the Node server can serve.          |
| Drag & drop  | `@dnd-kit/core` + `@dnd-kit/sortable`   | The standard for sortable drag & drop in React, accessible and keyboard-friendly. |
| State        | Zustand                                 | Simple, little boilerplate. Undo/redo via middleware (`zundo`).                   |
| YAML         | npm `yaml` (eemeli), **Document API**   | Keeps comments, anchors and order when editing (`doc.setIn([...], value)`).       |
| Forms        | React Hook Form + Zod                   | One Zod schema per widget that both validates and drives the form.                |
| Code editor  | CodeMirror 6 + `@codemirror/lang-yaml`  | Lighter than Monaco; per-line error markers.                                      |
| Backend      | Node + Hono                             | Small and fast, TypeScript end to end.                                            |
| Auth (Glaze) | Session cookie + Argon2/bcrypt hash     | Glaze writes config, so it always sits behind a login.                            |
| Tests        | Vitest (+ Playwright for the editor)    | Above all: "parse → edit → serialize changes nothing else".                       |
| Deployment   | Docker multi-stage build → single image | One container next to Glance; compose example in the README.                      |

**Core idea: the document model**
The UI works on a simplified model (pages → columns → widgets with an `id`). Every change is translated into a small edit of the YAML `Document`, never "regenerate the whole file". That's how comments survive.

```ts
// Illustrative types used by the UI
type ColumnSize = "small" | "full";

interface WidgetNode {
	id: string; // Glaze-generated id, not stored in the YAML
	type: string; // "monitor", "bookmarks", …
	path: (string | number)[]; // path in the YAML document, e.g. ["pages", 0, "columns", 2, "widgets", 0]
}

interface ColumnNode {
	id: string;
	size: ColumnSize;
	widgets: WidgetNode[];
}

interface PageNode {
	id: string;
	name: string;
	slug?: string;
	columns: ColumnNode[];
}
```

**Generating widget schemas**
A script (`scripts/generate-widget-schemas.ts`) reads the Glance Go source (`internal/glance/widget-*.go`), extracts each struct's fields with `yaml:"…"` tags and their Go types, and writes a JSON schema or Zod definition per widget. For a new Glance version you rerun the script and see what changed in the diff. Labels and help texts come from a separate translation file.

---

## 9. Security

- Glaze is **always behind a login**. Anyone who reaches Glaze can change the config, including API keys.
- Don't expose Glaze publicly without extra protection. README advice: Cloudflare Access, a VPN, or LAN only.
- Secrets: a "secret" field in the UI that stores the value in `.env` and writes `${NAME}` to the YAML. Warn when a key is stored as plain text in the YAML.
- Warn about `apiKey=` inside an `img src` (visible in the page source). Recommend a key with minimal permissions.
- Docker socket access (only needed for route A in §7) is optional and off by default.

---

## 10. Open source

- **License:** MIT. Glance itself is AGPL-3.0, but Glaze contains no Glance code; it only uses the Glance CLI and its config format.
- **Repository layout:**

  ```
  glaze-for-glance/
  ├─ apps/web/          React app (Vite)
  ├─ apps/server/       Node API (Hono)
  ├─ packages/core/     document model, YAML edits, layout rules (shared, well tested)
  ├─ packages/schemas/  generated widget schemas (planned)
  ├─ scripts/           generators (planned)
  ├─ docker/            Dockerfile, compose example (planned)
  └─ README.md, LICENSE, CONTRIBUTING.md
  ```

- Monorepo with **pnpm workspaces**.
- Releases via Git tags and GitHub Actions building the Docker image (GHCR).
- Announce once v0.1 works: r/selfhosted and the Glance Discord.

---

## 11. Roadmap

| Phase | Scope                                                         | Done when…                                                  | Status  |
| ----- | ------------------------------------------------------------- | ----------------------------------------------------------- | ------- |
| 0     | Project setup: monorepo, Vite + React + TS, Hono, lint/format | `pnpm dev` starts the app and the API                       | ✅ done |
| 1     | `packages/core`: parse → model → edit → serialize, with tests | A large real-world `glance.yml` round-trips without changes | ✅ done |
| 2     | Editor: pages, columns, drag & drop widgets (dnd-kit)         | Moving a widget produces a correct YAML diff                |         |
| 3     | Inspector + forms for 10 widgets                              | Monitor/bookmarks fully editable without YAML               |         |
| 4     | Code view + live preview + validation                         | Errors show up on the right line                            |         |
| 5     | Auth, Docker image, README → **v0.1 release**                 | Installable next to Glance                                  |         |
| 6+    | Themes, "Edit page" button, generated schemas, multiple users | See §5                                                      |         |

---

## 12. Open questions

1. Ship the Glance binary in the Glaze image for `config:validate`, or write our own validation in TypeScript based on the generated schemas?
2. Multiple users: build route A (one Glance per user), or first try a pull request for route B in Glance?
3. Publish straight to `glance.yml`, or first to a draft (`glance.draft.yml`) with "Publish" as a separate step? (The design assumes draft + Publish.)
4. Use `$include` to put every page in its own file (clearer, fewer conflicts)?
