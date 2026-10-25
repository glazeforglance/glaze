# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**Glaze** is an open-source visual editor for [Glance](https://github.com/glanceapp/glance) dashboards.
It runs next to Glance, reads and writes the same `glance.yml`, and lets people build pages with
drag & drop and forms instead of hand-written YAML. Glance stays the dashboard; Glaze only edits its config.

- Full design, architecture and roadmap: **`docs/DESIGN.md`** — read it before larger changes.
- Public overview: `README.md`.
- Target Glance version: **v0.8.7**. Facts about Glance in `docs/DESIGN.md` §5 were verified against its
  source code. When in doubt about a Glance option, check the Glance source (`internal/glance/*.go`,
  struct tags `yaml:"..."`) instead of guessing.

## Repository layout

```
apps/web/        React 19 + Vite + TypeScript + Tailwind CSS v4   (package name: web)
apps/server/     Hono on Node (tsx in dev), port 8090             (package name: server)
packages/core/   @glaze/core — YAML document model, edits, layout rules (shared by web + server)
docs/            DESIGN.md and other docs
```

- The web app proxies `/api/*` to the server (`apps/web/vite.config.ts`).
- `@glaze/core` exports TypeScript source directly (`"exports": { ".": "./src/index.ts" }`), no build step.

## Commands

Package manager is **pnpm** only. Never run `npm install` or create a `package-lock.json`.

```bash
pnpm install                          # install everything
pnpm dev                              # start web + server in parallel
pnpm --filter web <cmd>               # run in the web app
pnpm --filter server <cmd>            # run in the server
pnpm --filter @glaze/core <cmd>       # run in core
pnpm --filter web lint                # Oxlint
pnpm biome format --write .           # format with Biome
```

If pnpm reports `ERR_PNPM_IGNORED_BUILDS`, ask the user to run `pnpm approve-builds`; don't bypass it.

## Code conventions

- **TypeScript strict**, ESM only. No `any` (use `unknown` + narrowing), no non-null assertions unless justified.
- **All identifiers in English**: functions, variables, types, files, branches, commit messages.
- Named exports only, no default exports (except where a framework requires one, e.g. Vite config).
- Small, pure functions where possible. Side effects (file system, network) live in `apps/server`, not in `core`.
- Expected failures return a typed `Result<T, E>` instead of throwing; throw only for programmer errors.
- JSDoc on every exported function: what it does, parameters, return value.
- Code comments in English, short, explaining _why_ rather than _what_.
- React: function components and hooks only, no class components. Keep components small; move logic to hooks or `core`.
- Linting: **Oxlint**. Formatting: **Biome** (tabs, double quotes). Biome's linter should stay disabled so the two tools don't conflict.
- Tests: **Vitest**, next to the package in a `test/` folder. Every change in `core` needs tests.

## Rules for editing `glance.yml` (the most important part of Glaze)

- Use the `yaml` package's **Document API** (`parseDocument`, `getIn`/`setIn`/`deleteIn`, node types).
  Never convert to a plain JS object and dump it back — that destroys comments.
- Edits must be **minimal**: only the touched nodes change. Comments, anchors (`&name`), merge keys
  (`<<: *name`), key order, block scalars (`template: |` with Go templates `{{ ... }}`), `${ENV_VAR}`
  placeholders and `$include:` lines must survive untouched.
- The round-trip test (`serialize(parse(x)) === x`, byte for byte) must always pass.
- Enforce Glance's layout rules: a page has ≥1 column; max 3 columns (max 2 when `width: slim`);
  column `size` is `small` or `full`; exactly 1 or 2 `full` columns per page;
  no `group`/`split-column` inside a `group`.

## Security

- Never commit real API keys, passwords or `secret-key` values. Fixtures use obviously fake keys.
- Local test configs with real values go in `.dev/` (git-ignored).
- Glaze writes config files, so the server must always sit behind authentication once auth exists.
- Prefer `${ENV_VAR}` references over plain-text secrets in generated YAML.

## How to work with the maintainer (important)

The maintainer (Sean) is learning and wants to **understand and write much of the code himself**.

- **Plan first.** For anything beyond a trivial change, propose a short plan (files, public API, steps)
  and wait for an OK before writing code.
- **Explain in Dutch.** After writing or changing code, explain per file or function **what** it does,
  **how** it works and **why** it's built that way. Code itself (names, comments) stays in English.
- When Sean asks _how_ to do something, explain it and show an example — don't implement it unless he asks.
- **Don't edit files outside the scope of the current task.** Ask before touching other packages,
  config files or dependencies.
- **Don't add dependencies** without asking; say why it's needed and what the alternative is.
- Before saying you're done: run the relevant tests and type checks and show the results.
- Git: commit with **conventional commits** (`feat(core): ...`, `fix(web): ...`, `chore: ...`,
  `docs: ...`, `test(core): ...`) when asked. **Never push** unless explicitly asked.
