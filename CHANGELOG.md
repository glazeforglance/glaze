# Changelog

All notable changes to Glaze are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **The project moved to the `glazeforglance` organization**: the repository is now [glazeforglance/glaze](https://github.com/glazeforglance/glaze) and the image is `ghcr.io/glazeforglance/glaze`. The old `ghcr.io/klingesean/glaze` image no longer receives updates, so switch your compose file to the new name.
- New logo, with all brand assets (favicon, Apple touch icon, 512 px PNG, social preview) generated from one source logo.

## [0.1.1] - 2026-10-26

Fixes from the first real installs (ZimaOS / CasaOS with Docker Compose).

### Fixed

- **Password hash in Docker Compose.** `hash-password` now prints `scrypt:N:r:p:salt:hash` with base64url salt and hash, using only `A–Z a–z 0–9 _ : -`. The v0.1.0 format contained `$` signs, which Compose (and app installers that re-serialise compose files, such as ZimaOS and CasaOS) read as variables, so the hash arrived without its salt and hash. v0.1.0 hashes are still accepted when they arrive intact; a hash that lost its parts now gets a clear hint to regenerate it.
- **Asset files in Docker setups.** `server.assets-path` is a path inside the Glance container (e.g. `/assets`), so Glaze refused it and `custom.css` / `design.js` never showed up in the code view. Set `GLAZE_ASSETS_PATH` to where Glaze sees the same folder (see Added). When assets are refused, the message now points to `GLAZE_ASSETS_PATH`.

### Added

- `GLAZE_ADMIN_PASSWORD_FILE`, `GLAZE_ADMIN_PASSWORD_HASH_FILE` and `GLAZE_SECRET_FILE` read the value from a file (Docker secrets). Setting a variable and its `_FILE` variant together is refused.
- `GLAZE_ASSETS_PATH`: the folder inside the Glaze container with the files Glance serves under `/assets/`. Checked at startup like the config folder.
- README sections on the password options and on installing Glaze on ZimaOS / CasaOS.
- The Docker smoke test now starts Glaze through a compose file with an unquoted hash and an assets folder.

### Changed

- With `GLAZE_ADMIN_PASSWORD` (plain text), sessions from v0.1.0 end once after the upgrade, because the derived hash uses the new format.

## [0.1.0] - 2026-10-26

The first release: a visual editor that runs next to Glance v0.8.7 and edits its `glance.yml`.

### Added

- **Document model** (`@glaze/core`): parses `glance.yml` with the `yaml` Document API and writes back minimal edits. Comments, anchors, merge keys, block scalars, `${ENV_VAR}` placeholders and `$include` lines survive untouched; a byte-for-byte round-trip test guards it.
- **Layout rules** from Glance: at least one column, at most 3 (2 for `width: slim`), one or two `full` columns, no groups or split columns inside a group.
- **Editor**: page tabs (add, rename, reorder, delete), columns (add, remove, `small`/`full`), and drag & drop of widgets between columns and from the widget library, with undo.
- **Inspector with forms** for `clock`, `weather`, `calendar`, `search`, `bookmarks`, `monitor`, `rss`, `releases`, `docker-containers` and `group`, plus a YAML tab for every widget. Unchanged fields never touch the YAML.
- **Code view** (CodeMirror 6) with two-way sync to the editor, inline errors on the right line, "did you mean" fixes for unknown options, and editing of referenced asset files (`custom-css-file`, `/assets/` links in `document.head`).
- **Validation**: YAML syntax, layout rules and unknown options in TypeScript, plus `glance config:validate` when `GLANCE_BIN` is set.
- **Live preview** of the real Glance (`GLANCE_URL`) next to the code or full width, in desktop and phone sizes, refreshed after Publish once Glance has reloaded.
- **Publish review**: a summary of what changes and the remaining issues before writing; conflict handling when the file changed on disk. Shortcuts `Ctrl/Cmd + S` and `Ctrl/Cmd + 1/2/3`.
- **Login** for a single admin: scrypt password hashes (`hash-password` command), signed stateless session cookies (`HttpOnly`, `SameSite=Strict`, 14 days with renewal, ended by a password change), a login rate limit of 5 failures per IP per 5 minutes, CSRF origin checks and a strict Content-Security-Policy with a per-response style nonce.
- **Login overlay**: when a session ends mid-work, the login appears on top of the editor and the interrupted request is retried, so unpublished changes are never lost. User menu with the version and Log out.
- **Settings**: `GLAZE_ADMIN_USERNAME`, `GLAZE_ADMIN_PASSWORD_HASH`, `GLAZE_ADMIN_PASSWORD`, `GLAZE_SECRET`, `GLAZE_TRUST_PROXY`, `GLAZE_AUTH` and `GLAZE_WEB_DIST`, next to `GLAZE_CONFIG_PATH`, `GLAZE_PORT`, `GLANCE_BIN` and `GLANCE_URL`.
- **Safe writes**: temp file + rename, with an in-place fallback for single bind-mounted files; a startup check for file permissions that names the uids involved; graceful shutdown that finishes in-flight writes.
- **Production build**: one Node process serves the web app and the API (esbuild bundle); `/api/healthz` reports the version.
- **Docker image** `ghcr.io/klingesean/glaze` for `linux/amd64` and `linux/arm64`: non-root (uid 1000), with the checksum-verified Glance v0.8.7 binary for validation, a health check and a compose example.
- CI (typecheck, lint, tests, build, Docker smoke test) and a tag-driven release workflow.

[Unreleased]: https://github.com/glazeforglance/glaze/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/glazeforglance/glaze/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/glazeforglance/glaze/releases/tag/v0.1.0
