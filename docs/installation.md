# Installation

The [Quick start](../README.md#quick-start) in the README gets Glaze running in three steps. This page has the details: the full Docker Compose walkthrough, the password options, file permissions and updating. For ZimaOS and CasaOS, see [ZimaOS / CasaOS](zimaos-casaos.md).

## Docker Compose

You need Docker with Compose, and a folder with your `glance.yml` (for example `./config/glance.yml`).

> [!NOTE]
> Images up to v0.1.1 were published as `ghcr.io/klingesean/glaze`. That image no longer gets updates, so switch your compose file to `ghcr.io/glazeforglance/glaze`.

**1. Create a password hash** for the Glaze login:

```bash
docker run --rm -it ghcr.io/glazeforglance/glaze:latest hash-password
```

Type your password twice (nothing is shown while you type). The output is one line like `scrypt:32768:8:1:…:…`. It contains only letters, digits, `-`, `_` and `:`, so you can paste it anywhere as is: no quotes, no escaping.

**2. Add Glaze next to Glance** in your `compose.yml` (also in [`docker/compose.example.yml`](../docker/compose.example.yml)) and paste your hash:

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
    image: ghcr.io/glazeforglance/glaze:latest
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
> Glaze can change your dashboard config, including API keys. Keep it behind its login, and don't expose it to the internet without extra protection. See [Security](security.md).

## Password

Glaze has one admin account. There are three ways to give it a password; pick one:

| Option                                                          | When                                                                                                                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GLAZE_ADMIN_PASSWORD_HASH` (**recommended**)                   | The hash from `hash-password`. The password itself is never stored anywhere.                                                                                                                            |
| `GLAZE_ADMIN_PASSWORD`                                          | The password in plain text. Works, but Glaze logs a warning at startup, and the password sits in your compose file. The hash wins if both are set.                                                      |
| `GLAZE_ADMIN_PASSWORD_HASH_FILE` or `GLAZE_ADMIN_PASSWORD_FILE` | The path to a file holding the hash or password, e.g. a [Docker secret](https://docs.docker.com/compose/how-tos/use-secrets/) in `/run/secrets/`. Whitespace and newlines around the value are ignored. |

Setting both a variable and its `_FILE` variant is an error, so it's always clear which one counts. `GLAZE_SECRET_FILE` works the same way for `GLAZE_SECRET`.

> [!NOTE]
> **Upgrading from v0.1.0?** Its hashes look like `scrypt$32768$8$1$…$…`. Docker Compose reads every `$name` as a variable and replaces it with nothing, so the hash arrives broken (Glaze then says _"Looks like `$` signs were removed"_). Such a hash still works if it reaches Glaze intact, for example in single quotes in an `env_file`, or with every `$` written as `$$`. Simpler: run `hash-password` again (v0.1.1+) and use the new hash, which contains no `$`. Some app installers, such as ZimaOS and CasaOS, turn `$$` back into `$`; there regenerating is the only option.

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

Your config and login stay as they are; they live in your config folder and compose file. See the [changelog](../CHANGELOG.md) for what changed.
