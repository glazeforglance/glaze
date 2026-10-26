# Contributing to Glaze

Thanks for wanting to help! Bug reports, ideas and pull requests are all welcome.
For larger changes, please open an issue first so we can agree on the approach;
the design and roadmap are in [`docs/DESIGN.md`](docs/DESIGN.md).

## Setup

You need Node.js 24+ and pnpm (`corepack enable pnpm`).

```bash
pnpm install
cp .env.example .env
pnpm dev
```

In `.env`, point `GLAZE_CONFIG_PATH` at a `glance.yml` and set a password: run
`pnpm --filter server hash-password` and add the result as `GLAZE_ADMIN_PASSWORD_HASH='…'`
(single quotes), or set `GLAZE_AUTH=off` while developing. `pnpm dev` starts the web app
on <http://localhost:5173> and the API on port 8090.

**pnpm only.** Don't run `npm install` or commit a `package-lock.json`. If pnpm reports
`ERR_PNPM_IGNORED_BUILDS`, mention it in your PR instead of working around it.

## Before you open a PR

```bash
pnpm test
pnpm typecheck
pnpm --filter web lint
pnpm biome format --write .
pnpm build
```

CI runs the same checks, builds the Docker image and smoke-tests it.

## Conventions

- TypeScript strict, ESM, named exports, no `any`. Expected failures return a `Result`, not an exception.
- Identifiers, comments and commit messages in English. JSDoc on exported functions.
- Formatting: Biome (tabs, double quotes). Linting: Oxlint.
- Tests: Vitest, in each package's `test/` folder.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat(core): …`, `fix(web): …`, `test(server): …`, `docs: …`, `chore: …`.

## Working on `packages/core`

`@glaze/core` turns `glance.yml` into a model and back. It's the most important part of Glaze:

- Always use the `yaml` **Document API** (`parseDocument`, `getIn`/`setIn`/`deleteIn`, node types). Never convert to a plain object and dump it back; that destroys comments.
- Edits must be minimal: comments, anchors, merge keys, key order, block scalars, `${ENV_VAR}` and `$include` lines must survive.
- Every change needs tests in `packages/core/test/`, and the byte-for-byte round-trip test must keep passing.
- No side effects (file system, network) in core; those belong in `apps/server`.
- When in doubt about a Glance option, check the Glance v0.8.7 source (`internal/glance/*.go`, `yaml:"…"` struct tags).

## Never commit real keys

Fixtures and tests use obviously fake values (`xxx`, `test-secret-…`). Keep your own config with
real values in `.dev/` (git-ignored) and never copy it into fixtures, tests, issues or PRs.
When you share YAML in an issue, remove every API key, password and secret first.
