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

## Scripts

Run these from the repository root.

| Command                      | What it does                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                   | Starts the web app (Vite, port 5173) and the API server (port 8090) with live reload.                                        |
| `pnpm build`                 | Builds every package that has a `build` script: the web app (`apps/web/dist`) and the server bundle.                         |
| `pnpm test`                  | Runs the Vitest suites of every package, then `pnpm test:scripts`.                                                           |
| `pnpm test:scripts`          | Tests for the scripts in `scripts/` (release, schema generator, translations), with Node's own test runner.                  |
| `pnpm typecheck`             | `tsc` for every package.                                                                                                     |
| `pnpm schemas`               | Regenerates `packages/schemas/src/generated/` from the Glance source; see [Widget schemas](#widget-schemas).                 |
| `pnpm brand`                 | Regenerates the favicon, touch icon, PNG logo and social preview from `docs/brand/glaze-logo.svg`.                           |
| `pnpm screenshots`           | Re-takes the images in `docs/screenshots/`; see [Screenshots](#screenshots).                                                 |
| `pnpm i18n --check`          | Checks the translations; `--write` also updates the table in TRANSLATING.md. See [Translations](#translations).              |
| `pnpm release:prepare X.Y.Z` | Maintainers: sets the version, dates the changelog and refreshes the translation table; see [RELEASING.md](../RELEASING.md). |

Per package: `pnpm --filter web lint` (Oxlint), `pnpm --filter server start` (the production build) and `pnpm --filter server hash-password`. Formatting: `pnpm biome format --write .`. `pnpm brand --check` and `pnpm schemas --check` only compare, and fail when the committed files are stale; CI runs both.

The app's keyboard shortcuts are in [Using Glaze](usage.md#keyboard-shortcuts).

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
pnpm schemas --tag v0.9.0       # another Glance version
pnpm schemas --check            # CI: fail when the committed files are stale
```

Labels, help texts, enums the code doesn't spell out and the options a new widget starts with live in [`packages/schemas/overrides.ts`](../packages/schemas/overrides.ts); never edit `src/generated/` by hand. The generator fails when an override no longer matches Glance, so a new Glance version shows up as a clear list of things to update. See [DESIGN.md §8](DESIGN.md#8-tech-stack) for how it works.

### Adding or adjusting a widget form

The forms are drawn from the schemas, so a form change is almost always a change in `overrides.ts`:

1. Find the widget under `widgets` (e.g. `"dns-stats"`). The shared widget fields are under `base`, the page settings under `page` and the Settings view under `config`.
2. Per widget: `label`, `description`, `order` (field order), `groups` (sections; a group with `tab: "style"` goes to the Style tab) and `newWidget` (the options a widget starts with when it's added). Per field: `label`, `help`, `placeholder`, `options` (enum values with labels), `default`, `min`/`max`, `required`, `advanced` (folded under "More options"), `group`, `warning`, and nested `fields`, `item` or `variants`.
3. Run `pnpm schemas`, read the diff in `src/generated/`, and commit both files.
4. Run `pnpm test`. The widget's fixture in `packages/schemas/test/fixtures/<type>.yml` (fake values only) must still go through the form edits, and the coverage test fails when an option can't be reached in any form. If you changed `newWidget`, also run the Glance integration test below.

When a new Glance version adds a widget type: add it to the library in [`apps/web/src/lib/widget-catalog.ts`](../apps/web/src/lib/widget-catalog.ts) (label, two-letter badge, group), give it an override entry and a fixture. The rare field the generic form can't draw well gets a hand-made component, registered in [`apps/web/src/forms/custom-fields.ts`](../apps/web/src/forms/custom-fields.ts) (today: the docker container labels and the custom-api template).

To run the integration test against Glance itself (CI does this with v0.8.7), point `GLANCE_BIN` at a Glance binary:

```bash
GLANCE_BIN=/path/to/glance pnpm --filter server test
```

## Screenshots

The images in [`docs/screenshots/`](screenshots/) come from `pnpm screenshots`. It starts the production build with the demo config in [`docs/screenshots/demo/glance.yml`](screenshots/demo/glance.yml) (auth off, on a free port), drives it with Playwright and writes the PNGs. All edits happen in the browser; the demo config is copied to a temp folder first.

```bash
pnpm exec playwright install chromium   # once
pnpm build
GLANCE_BIN=/path/to/glance pnpm screenshots
```

| Image              | Shows                                                    |
| ------------------ | -------------------------------------------------------- |
| `editor.png`       | The Design view with a monitor selected (README hero)    |
| `code-preview.png` | The Code view with the live preview (needs `GLANCE_BIN`) |
| `validation.png`   | A typo with its unknown-option warning and Fix button    |
| `publish.png`      | The publish review                                       |
| `split-column.png` | Three widgets side by side, the width handle dragged     |
| `custom-api.png`   | The custom-api template and its cheat sheet              |
| `settings.png`     | The Settings view, Theme section                         |
| `login.png`        | The login screen                                         |

The live preview shot needs Glance: set `GLANCE_BIN` to a Glance v0.8.7 binary and keep port 8080 free. Without it, that shot is skipped. The script doesn't read `.env`, so pass `GLANCE_BIN` on the command line.

To change or add a shot, edit the demo config (fake hosts and `${VAR}` secrets only, never anything from `.dev/`) and the matching function in [`scripts/screenshots.ts`](../scripts/screenshots.ts). Re-run the script whenever the UI changed, look at every image before committing, and keep each PNG under 400 KB.

## Translations

The UI uses [i18next](https://www.i18next.com/) with react-i18next. Texts live in `apps/web/src/locales/<lang>/` as i18next JSON v4: `app.json` for the interface and `fields.json` for the widget, page and setting labels. English is the source and the fallback; other languages are loaded when they're picked. How translators work (Weblate) is in [TRANSLATING.md](../TRANSLATING.md); the Weblate setup in [RELEASING.md](../RELEASING.md#weblate-setup).

### Adding a text to the UI

1. Add the English text to `apps/web/src/locales/en/app.json`, under the part of the app it belongs to (e.g. `canvas.addColumn`). Values go in `{{name}}`; plurals get `_one` and `_other` keys and are called with `count`.
2. Use it: `const { t } = useTranslation();` and `t("canvas.addColumn")` in components, `i18n.t(…)` from `src/i18n.ts` outside them. Sentences with markup use `<Trans>` with named tags (`"…<file>{{file}}</file>…"`). The keys are typed, so a typo is a type error.
3. Run `pnpm i18n --check`. It fails when the code and `en/app.json` disagree (a key nobody uses, or a key that doesn't exist).
4. Don't touch the other languages: translators pick the new text up on Weblate. Until then it shows in English.

Widget, page and setting labels are different: change them in `packages/schemas/overrides.ts` and run `pnpm schemas`, which regenerates `en/fields.json`. Never edit that file by hand.

A few rules that keep the UI translatable:

- Never build a sentence from pieces (`"Add " + name`); give translators the whole sentence with a placeholder.
- Errors from `@glaze/core` and the server carry a `code` and `params`; `src/lib/messages.ts` turns them into sentences. Add a sentence there (and under `problems`, `editErrors` or `api`) when you add a code. Glance's own messages stay English.
- Glance option names, YAML and code are never translated. Show user text (titles, page names) with `dir="auto"` or `<bdi>`, and code, URLs and keys with `dir="ltr"`.
- Use logical Tailwind utilities (`ms-`, `pe-`, `start-`, `border-s`, `text-start`), never `ml-`/`left-`/`text-left`. Anything with a direction in behaviour (arrow keys, drag & drop, resize handles) goes through `src/lib/direction.ts`.
- Dates and numbers: `formatTime` / `formatNumber` from `src/lib/format.ts`, with the locale from `useLanguage()`.

`node apps/web/scripts/find-literals.ts` lists texts in JSX or attributes that don't go through `t()`, with the few justified exceptions (product name, file names, URL placeholders).

### Testing right-to-left

There's a pseudo-language `rtl-test`: English text, laid out right to left. In `pnpm dev` it's in the language picker; in a production build, set it in the browser console with `localStorage.setItem("glaze.language", "rtl-test")` and reload. `pnpm screenshots --locale rtl-test` (after `pnpm build`) saves the editor, the inspector and the Settings view to `.dev/screenshots/rtl-test/`; `--locale <code>` does the same for any translation, handy to check long labels.

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
