# syntax=docker/dockerfile:1

# Glaze: visual editor for Glance. Multi-arch (linux/amd64, linux/arm64).
#
#   docker buildx build -f docker/Dockerfile --platform linux/amd64,linux/arm64 .
#
# The build and glance stages run on the build machine's own platform
# ($BUILDPLATFORM): their output (JavaScript, and a Glance binary downloaded
# for $TARGETARCH) doesn't depend on it, and it avoids slow emulation.

# ── 1. build: install, test-free production build of web + server ──
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /src
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# pnpm in the exact version from package.json's "packageManager".
RUN corepack enable
# Manifests first, so the install layer is cached until dependencies change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ── 2. glance: the Glance binary for `glance config:validate` ──
FROM --platform=$BUILDPLATFORM alpine:3.22 AS glance
ARG TARGETARCH
ARG GLANCE_VERSION=v0.8.7
# Glance releases have no checksums file (goreleaser `checksum: disable`).
# These are GitHub's SHA-256 digests of the v0.8.7 assets
# (api.github.com/repos/glanceapp/glance/releases/tags/v0.8.7, field "digest").
# Update them together with GLANCE_VERSION; sha256sum -c fails the build on a mismatch.
ARG GLANCE_SHA256_AMD64=b9c169623825753e87f31e89514eefdeda38f51b6c024dcc4348fe087bc3592f
ARG GLANCE_SHA256_ARM64=ddd44e888a77ae88a52cf8b860927c89d5bcec5b1886d45936dd29496449ab0c
RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) sum="$GLANCE_SHA256_AMD64" ;; \
      arm64) sum="$GLANCE_SHA256_ARM64" ;; \
      *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    wget -q -O /tmp/glance.tar.gz \
      "https://github.com/glanceapp/glance/releases/download/${GLANCE_VERSION}/glance-linux-${TARGETARCH}.tar.gz"; \
    echo "${sum}  /tmp/glance.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/glance.tar.gz -C /tmp glance; \
    install -m 0755 /tmp/glance /usr/local/bin/glance

# ── 3. runtime: Node, the bundle, the web build and Glance; nothing else ──
FROM node:24-alpine AS runtime
ARG VERSION=dev
LABEL org.opencontainers.image.title="Glaze" \
      org.opencontainers.image.description="A visual editor for Glance dashboards" \
      org.opencontainers.image.source="https://github.com/klingesean/glaze-for-glance" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}"

ENV NODE_ENV=production \
    GLAZE_CONFIG_PATH=/config/glance.yml \
    GLANCE_BIN=/usr/local/bin/glance \
    GLAZE_PORT=8090 \
    NODE_OPTIONS=--enable-source-maps

# The same layout as the repository, so the bundle finds ../../web/dist.
WORKDIR /app/apps/server
COPY --from=build /src/apps/server/dist ./dist
COPY --from=build /src/apps/web/dist /app/apps/web/dist
COPY --from=glance /usr/local/bin/glance /usr/local/bin/glance
# A fresh named volume on /config inherits this owner, so uid 1000 can write it.
RUN mkdir -p /config && chown node:node /config

# uid 1000 from the node image; see "File permissions" in the README.
USER node
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.GLAZE_PORT || 8090) + '/api/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

# `docker run --rm -it <image> hash-password` runs the password tool instead.
ENTRYPOINT ["node", "dist/index.js"]
