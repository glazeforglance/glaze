# Glaze: design document

> Status: v0.1.0 · phases 0–5 done
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

**Glaze**: a glaze layer on top of Glance. Short, and it sounds almost the same. The project lives in the GitHub organization `glazeforglance`, as the repository `glazeforglance/glaze`; "Glaze" is the product name.

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
- Glance CLI: `config:validate`, `config:print`, `secret:make`, `password:hash`, `sensors:print`, `mountpoint:info`, `diagnose`. The config path is set with `--config <path>` (default `glance.yml`); `config:validate` resolves `$include`s relative to that file.
- Glance sends no `X-Frame-Options` or CSP `frame-ancestors` header, so it can be shown in an iframe.

**Theme** (`theme:` in `config.go` / `theme.go`)

- `background-color`, `primary-color`, `positive-color`, `negative-color`: HSL strings like `"240 13 14"` (hue 0–360, saturation and lightness 0–100).
- `light` (bool), `contrast-multiplier`, `text-saturation-multiplier` (floats).
- `custom-css-file`: a stylesheet Glance loads on every page (usually under `server.assets-path`, served at `/assets/`).
- `presets`: named extra themes with the same fields; Glance shows a theme switcher when presets exist.
- Glance's own CSS uses variables such as `--border-radius`, `--font-size-base`, `--widget-gap` and `--widget-content-padding`, which a custom CSS file can override.

**Widget size**

- Glance has **no width or height option per widget.** A widget always fills its column's width, and its height follows its content.
- Side by side is only possible with `split-column` (`max-columns` ≥ 2).
- Each widget renders as `.widget` > `.widget-header` + `.widget-content`, and `css-class` is added to the widget's root element. Height can therefore only be controlled with custom CSS via `css-class`.

**`custom-api` templates**

- The response is available as `.JSON` with helpers `.JSON.String "path"`, `.Int`, `.Float`, `.Bool`, `.Array`, `.Exists`, `.Get` (gjson paths).
- The template is Go `html/template`; it can use Glance's utility classes (`list`, `size-h3`, `color-highlight`, `color-positive`, …) so it looks native.

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
- Library of custom CSS presets (for example a "dark cards" style).
- "Edit page" button in Glance via `document.head`.
- Undo/redo and a version history (`.glaze/history/`).

### v0.3

- Multiple users with their own layout (§7).
- Templates ("Calm", "Homelab", "Media").
- Secrets management: keys as `${VAR}` in a `.env` file, never as plain text in the YAML.

### Extras (final phase)

Three bigger tools that build on the editor. Each one still compiles down to plain Glance config (YAML + one CSS file), so principle 3 holds: nothing Glaze makes needs Glaze to keep working.

**1. Widget size: width and height inside a column**

Glance has no size options per widget (§4), so Glaze translates sizes into things Glance does understand:

- **Width** → `split-column`. Dragging a widget's right edge snaps to _full / ½ / ⅓_ of the column. Glaze then wraps the widget and its neighbour(s) in a `split-column` with the matching `max-columns`, or unwraps it again when the widget goes back to full width. The canvas shows the snap points while dragging.
- **Height** → `css-class` + generated CSS. Dragging the bottom edge snaps to _auto / S / M / L / XL_ (or a custom px value in the inspector). Glaze adds a class such as `glaze-h-320` to the widget's `css-class` (keeping any classes that were already there) and writes the rule to a **Glaze-managed CSS file** (`assets/glaze.css`, linked through `theme.custom-css-file` or appended to an existing custom CSS file between `/* glaze:start */ … /* glaze:end */` markers):

  ```css
  .glaze-h-320 .widget-content { height: 320px; overflow-y: auto; }
  ```
- Rules: no resizing inside `group` (tabs share one height), `split-column` keeps Glance's limits, and unused generated classes are cleaned up on Publish.
- The inspector's Style tab gets the same controls (width segmented control, height select + px input) for keyboard users.

**2. Widget builder**

A separate screen for making your own widgets on top of `custom-api`, with the same layout as the editor:

- **Left:** a library of blocks: text, heading, value + label (stat), list / repeat, image, link, badge / status dot, progress bar, two-column row, divider.
- **Center:** a canvas with the widget at real column width (`small` / `full` toggle), filled with data from a sample response.
- **Right:** an inspector with three tabs:
  - **Data:** `url`, `method`, `headers`, `parameters`, `body` and `subrequests`. Secrets are entered as `${ENV_VAR}`. A "Fetch sample" button lets the Glaze server do the request (admin only, with a timeout, because this is a server-side request) and shows the JSON in a tree explorer.
  - **Block:** binds a block field to a JSON path by clicking in the explorer (for example `.JSON.String "data.0.title"`). It also has formatting options (number, relative time via `toRelativeTime`, …) and a condition ("only show if …").
  - **Template:** the generated Go template, read-only. "Detach" turns it into a hand-edited template, after which the visual builder is switched off for that widget.
- **Output:** a normal `custom-api` widget in `glance.yml`. The block tree is saved in `.glaze/widgets/<id>.json`, and the YAML gets a `# glaze-widget: <id>` comment, so the widget can be opened in the builder again. If the template in the YAML was changed by hand since then, the builder warns before overwriting it.
- **Preview:** the builder renders its own block tree in TypeScript against the sample JSON, rather than running Go templates. Because Glaze generates the template, the two stay in sync, and tests check that every block produces the expected template. The real result is visible in the live preview after Publish.
- Saved widgets appear in the editor's library under **"My widgets"**. This is the basis for the recipe marketplace later on.

**3. Theme editor**

Like the theme generators of daisyUI or shadcn/ui, but for Glance's theme options:

- **Left:** preset list (the `theme` itself plus every entry in `theme.presets`), with buttons for new, duplicate, rename and delete, and a few built-in starter themes.
- **Center:** a live preview of a sample Glance page (header, nav, a few typical widgets in two columns) that updates as you drag. It is drawn with Glaze's own components using the same variables, because Glance's CSS is AGPL and isn't copied into Glaze. After Publish, the real Glance in the preview iframe shows the actual result. A dark/light toggle and a desktop/phone toggle are included.
- **Right:** controls:
  - Color pickers for background / primary / positive / negative. They show HSL sliders plus a hex input, and Glaze converts to Glance's `"h s l"` format.
  - Toggle for `light`, sliders for `contrast-multiplier` and `text-saturation-multiplier`.
  - "Generate from one color": pick a primary color and get a matching background and status colors.
  - Contrast check (WCAG AA) on text vs. background and primary vs. background, with a warning.
  - Extras written to the Glaze-managed CSS file: corner radius (`--border-radius`), base font size (`--font-size-base`), widget gap (`--widget-gap`), font family (web font via `@import`).
- **Import / export:** paste a `theme:` YAML block, or copy the current theme as YAML/CSS to share.
- Every change goes through `@glaze/core` edits on the `theme:` map, so comments and other keys survive.

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
5. **Widget size (in the editor):** a selected widget gets resize handles on its right and bottom edges. While dragging, snap lines show ½ / ⅓ width and S–XL height, with a small label ("½ · 320px").
6. **Widget builder:** same three-panel layout as the editor (block library, canvas, inspector with Data / Block / Template tabs) plus a JSON explorer under the Data tab. Top bar: widget name, column-width toggle, "Fetch sample", **Save** and "Add to page".
7. **Theme editor:** preset list on the left, a sample Glance page in the middle, and color pickers + sliders on the right. Top bar: dark/light and desktop/phone toggles, Import, Export and **Publish**.

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
| Auth (Glaze) | Signed session cookie + scrypt hash     | Glaze writes config, so it always sits behind a login (see §9).                   |
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
- **How the login works (v0.1, single admin):**
  - **Account:** `GLAZE_ADMIN_USERNAME` (default `admin`) and `GLAZE_ADMIN_PASSWORD_HASH`, a scrypt hash `scrypt:N:r:p:salt:hash` (N=2^15, r=8, p=1, 16-byte salt, 32-byte key, base64url without padding) made with the `hash-password` command. Since v0.1.1 the hash contains only `[A-Za-z0-9_:-]`, because Docker Compose and app installers like ZimaOS/CasaOS interpolate `$`; the v0.1.0 format `scrypt$…$…` (standard base64) is still accepted. Every secret can also come from a file (`GLAZE_ADMIN_PASSWORD_FILE`, `GLAZE_ADMIN_PASSWORD_HASH_FILE`, `GLAZE_SECRET_FILE`). `node:crypto` only, so no native modules in the Docker image. A plain `GLAZE_ADMIN_PASSWORD` works too (warning at startup; the hash wins when both are set). Without a password, or with `GLAZE_AUTH=off` in production, the server refuses to start.
  - **Login:** `POST /api/auth/login`. scrypt always runs and the username is compared in constant time, so a wrong user and a wrong password look the same (same answer, same timing).
  - **Sessions:** stateless cookie `glaze_session` = base64url payload `{ user, exp, pwdTag }` + HMAC-SHA256 signature, checked in constant time. `pwdTag` is an HMAC of the current password hash, so a password change ends every session. 14 days, renewed when less than 7 are left. `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure` over HTTPS. The key is `GLAZE_SECRET`, or a random secret created once in `<config folder>/.glaze/secret` (mode 0600), so sessions survive restarts.
  - **Brute force:** 5 failed logins per IP per 5 minutes, then `429` with `Retry-After` (in memory, expired entries swept).
  - **CSRF:** `SameSite=Strict` plus Hono's `csrf()` origin check on every non-GET API request that a plain form could send; JSON requests from other sites need a CORS preflight that Glaze never allows.
  - **Headers:** `secureHeaders` with a CSP of `default-src 'self'`, `frame-src` and `connect-src` for the `GLANCE_URL` origin only (preview and health poll), `frame-ancestors 'none'`. Two deliberate exceptions: `style-src` carries a per-response nonce (written into `index.html`) for CodeMirror's `<style>` elements, and `font-src` allows `data:` for the small font subsets Vite inlines.
  - **Proxies:** only with `GLAZE_TRUST_PROXY=true` does Glaze read the client IP from `CF-Connecting-IP` or the last `X-Forwarded-For` entry, and HTTPS from `X-Forwarded-Proto`.
  - **Everything else:** every `/api/*` route except `/api/healthz` and `/api/auth/*` answers `401` without a valid session. In the browser, a `401` opens a login overlay over the editor and retries the request afterwards, so unpublished work survives.
- Don't expose Glaze publicly without extra protection. README advice: Cloudflare Access, a VPN, or LAN only.
- Secrets: a "secret" field in the UI that stores the value in `.env` and writes `${NAME}` to the YAML. Warn when a key is stored as plain text in the YAML.
- Warn about `apiKey=` inside an `img src` (visible in the page source). Recommend a key with minimal permissions.
- Docker socket access (only needed for route A in §7) is optional and off by default.

---

## 10. Open source

- **License:** MIT. Glance itself is AGPL-3.0, but Glaze contains no Glance code; it only uses the Glance CLI and its config format. The Docker image ships the unmodified Glance binary for `config:validate`, with a pointer to its source.
- **Repository:** [`glazeforglance/glaze`](https://github.com/glazeforglance/glaze), in the `glazeforglance` organization. The image is `ghcr.io/glazeforglance/glaze`.
- **Repository layout:**

  ```
  glaze/
  ├─ apps/web/          React app (Vite)
  ├─ apps/server/       Node API (Hono)
  ├─ packages/core/     document model, YAML edits, layout rules (shared, well tested)
  ├─ packages/schemas/  generated widget schemas (planned)
  ├─ scripts/           generators (planned)
  ├─ docker/            Dockerfile, compose example, smoke test
  └─ README.md, LICENSE, CONTRIBUTING.md
  ```

- Monorepo with **pnpm workspaces**.
- Releases via Git tags and GitHub Actions building the Docker image (GHCR).
- Announce once v0.1 works: r/selfhosted and the Glance Discord.

---

## 11. Roadmap

| Phase | Scope                                                         | Done when…                                                                                        | Status  |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------- |
| 0     | Project setup: monorepo, Vite + React + TS, Hono, lint/format | `pnpm dev` starts the app and the API                                                             | ✅ done |
| 1     | `packages/core`: parse → model → edit → serialize, with tests | A large real-world `glance.yml` round-trips without changes                                       | ✅ done |
| 2     | Editor: pages, columns, drag & drop widgets (dnd-kit)         | Moving a widget produces a correct YAML diff                                                      | ✅ done |
| 3     | Inspector + forms for 10 widgets                              | Monitor/bookmarks fully editable without YAML                                                     | ✅ done |
| 4     | Code view + live preview + validation                         | Errors show up on the right line                                                                  | ✅ done |
| 5     | Auth, Docker image, README → **v0.1 release**                 | Installable next to Glance                                                                        | ✅ done |
| 6     | "Edit page" button, generated schemas, multiple users         | See §5 (v0.2 / v0.3)                                                                              |         |
| 7     | Extras: widget size, widget builder, theme editor             | A resized widget, a builder widget and a theme all survive a round-trip and render in real Glance |         |

---

## 12. Open questions

1. ~~Ship the Glance binary in the Glaze image for `config:validate`, or write our own validation in TypeScript based on the generated schemas?~~ **Answered (phase 4): both.** Glaze runs `glance config:validate` when `GLANCE_BIN` points to a Glance binary (the Docker image ships one), because only Glance itself knows every rule. Next to that, Glaze has its own TypeScript checks that always run, also without the binary: YAML syntax, the layout rules from §4 and unknown options (warnings with a "did you mean" fix, from the keys of the widget schemas). Glance's errors carry a line only when the draft has no `$include`, since Glance inlines includes before it counts lines.
2. Multiple users: build route A (one Glance per user), or first try a pull request for route B in Glance?
3. ~~Publish straight to `glance.yml`, or first to a draft (`glance.draft.yml`) with "Publish" as a separate step?~~ **Answered (phase 4–5): the draft lives in the browser.** Every edit (design, forms, code view, asset files) stays in the editor until Publish; nothing is written on the way, and there's no `glance.draft.yml`. Publish shows a review, the server validates the text again (YAML, layout, unknown options and `glance config:validate`) and only then writes `glance.yml` (temp file + rename), refusing broken YAML always and other errors unless forced. A changed file on disk is a conflict, not an overwrite.
4. Use `$include` to put every page in its own file (clearer, fewer conflicts)?
5. Widget size: when a widget becomes ½ width but has no neighbour to share the row with, should Glaze leave empty space (a `split-column` with one widget) or refuse the resize?
6. Glaze-managed CSS: always a separate `assets/glaze.css`, or a marked block inside the user's existing custom CSS file? Glance accepts only one `custom-css-file`, so a separate file means adding an `@import` to the existing one.
7. Widget builder preview: is a TypeScript renderer of our own block tree enough, or do we want a "render in Glance" preview (e.g. a hidden scratch page) for hand-edited templates?
