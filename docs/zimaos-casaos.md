# ZimaOS / CasaOS

ZimaOS and CasaOS install apps from a compose file and re-serialise it, so values must be free of `$` signs (the v0.1.1+ hash is). If Glance keeps its config in `/DATA/AppData/glance/config` and uses `server.assets-path: /assets` (served from `/DATA/AppData/glance/config/assets` on the host), add Glaze as a **custom app** via **Import → Docker Compose**:

> [!NOTE]
> Images up to v0.1.1 were published as `ghcr.io/klingesean/glaze`. That image no longer gets updates, so switch your compose file to `ghcr.io/glazeforglance/glaze`.

```yaml
name: glaze
services:
  glaze:
    image: ghcr.io/glazeforglance/glaze:latest
    container_name: glaze
    restart: unless-stopped
    # The AppData folders belong to root on ZimaOS/CasaOS.
    user: "0:0"
    ports:
      - "8090:8090"
    volumes:
      - type: bind
        source: /DATA/AppData/glance/config
        target: /config
    environment:
      # Fake example: run `docker run --rm -it ghcr.io/glazeforglance/glaze:latest hash-password`
      # in the ZimaOS/CasaOS terminal and paste your own hash here.
      GLAZE_ADMIN_PASSWORD_HASH: scrypt:32768:8:1:FAKEsaltReplaceMe0000w:FAKEhashRunHashPasswordAndPasteYourOwn00000
      # Glance serves this folder as /assets/; inside Glaze it's here.
      GLAZE_ASSETS_PATH: /config/assets
      # Where your browser reaches Glance (your device's IP and Glance's port).
      GLANCE_URL: http://192.168.1.10:8080
x-casaos:
  architectures:
    - amd64
    - arm64
  main: glaze
  icon: https://raw.githubusercontent.com/glazeforglance/glaze/main/docs/brand/glaze-logo-512.png
  title:
    en_us: Glaze
  description:
    en_us: A visual editor for Glance dashboards
  port_map: "8090"
```

Adjust the host path and `GLANCE_URL` to your setup. `user: "0:0"` runs Glaze as root, because root owns the AppData folders; the alternative is `chown -R 1000:1000 /DATA/AppData/glance/config` and leaving `user:` out (see [File permissions](installation.md#file-permissions)).
