#!/bin/sh
# Smoke test for the Glaze image: starts it through Docker Compose on a temp
# copy of a fake config and checks health, auth, reading, writing, asset
# files and validation with the bundled Glance. Never uses .dev/ or real values.
#
#   sh docker/smoke-test.sh [image]        (default image: glaze:smoke)
set -eu

IMAGE="${1:-glaze:smoke}"
PORT="${SMOKE_PORT:-18090}"
PASSWORD="smoke-test-password-$$"
NAME="glaze-smoke-$$"
WORK="$(mktemp -d)"
BASE="http://127.0.0.1:$PORT"
JAR="$WORK/cookies.txt"
COMPOSE="$WORK/compose.yml"

compose() {
	docker compose -f "$COMPOSE" -p "$NAME" "$@"
}

cleanup() {
	[ -f "$COMPOSE" ] && compose down --timeout 5 >/dev/null 2>&1 || true
	rm -rf "$WORK"
}
trap cleanup EXIT

fail() {
	echo "FAIL: $*" >&2
	docker logs "$NAME" 2>&1 | tail -20 >&2 || true
	exit 1
}

CSS='.widget { border-radius: 4px; }'
mkdir -p "$WORK/config/assets"
printf '%s\n' "$CSS" >"$WORK/config/assets/custom.css"
cat >"$WORK/config/glance.yml" <<'YAML'
# Smoke test config, fake values only.
server:
  assets-path: /assets
theme:
  custom-css-file: /assets/custom.css
pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: clock
YAML

echo "→ hash-password (piped)"
HASH="$(printf '%s\n%s\n' "$PASSWORD" "$PASSWORD" | docker run --rm -i "$IMAGE" hash-password)"
case "$HASH" in
scrypt:*) ;;
*) fail "hash-password printed no scrypt: hash" ;;
esac
case "$HASH" in
*'$'*) fail "the hash contains a \$ sign" ;;
esac

# Like a user's compose file: the hash unquoted, Glance's /assets folder
# mounted at /config/assets, and the folder owner as `user:`.
cat >"$COMPOSE" <<EOF
services:
  glaze:
    image: $IMAGE
    container_name: $NAME
    user: "$(id -u):$(id -g)"
    ports:
      - "127.0.0.1:$PORT:8090"
    volumes:
      - $WORK/config:/config
    environment:
      GLAZE_ADMIN_PASSWORD_HASH: $HASH
      GLAZE_ASSETS_PATH: /config/assets
EOF

echo "→ Compose keeps the hash intact (no \$ interpolation)"
compose config | grep -qF "$HASH" || fail "docker compose config changed the hash"

echo "→ start with docker compose"
compose up -d >/dev/null 2>&1 || fail "docker compose up failed"

i=0
until curl -fsS "$BASE/api/healthz" >/dev/null 2>&1; do
	i=$((i + 1))
	[ "$i" -lt 30 ] || fail "healthz never answered"
	sleep 1
done
echo "→ healthz: $(curl -fsS "$BASE/api/healthz")"

echo "→ runs as non-root"
[ "$(docker exec "$NAME" id -u)" != "0" ] || fail "container runs as root"

echo "→ 401 without login"
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/config")"
[ "$code" = "401" ] || fail "expected 401, got $code"

echo "→ wrong password is refused"
code="$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
	-d '{"username":"admin","password":"wrong"}' "$BASE/api/auth/login")"
[ "$code" = "401" ] || fail "expected 401 for a wrong password, got $code"

echo "→ login with the hash that went through Compose"
curl -fsS -c "$JAR" -H 'Content-Type: application/json' \
	-d "{\"username\":\"admin\",\"password\":\"$PASSWORD\"}" \
	"$BASE/api/auth/login" >/dev/null || fail "login failed"

echo "→ GET /api/config"
CONFIG="$(curl -fsS -b "$JAR" "$BASE/api/config")" || fail "GET /api/config failed"
VERSION="$(printf '%s' "$CONFIG" | sed -n 's/.*"version":"\([0-9a-f]*\)".*/\1/p')"
[ -n "$VERSION" ] || fail "no version in $CONFIG"

echo "→ asset files via GLAZE_ASSETS_PATH"
FILES="$(curl -fsS -b "$JAR" "$BASE/api/files")"
printf '%s' "$FILES" | grep -q '"name":"custom.css"' || fail "custom.css not listed: $FILES"
curl -fsS -b "$JAR" "$BASE/api/files/custom.css" | grep -qF 'border-radius' ||
	fail "custom.css not readable"

echo "→ POST /api/validate runs Glance (an unknown widget type is a Glance error)"
VALIDATE="$(curl -fsS -b "$JAR" -H 'Content-Type: application/json' \
	-d '{"text":"pages:\n  - name: Home\n    columns:\n      - size: full\n        widgets:\n          - type: no-such-widget\n"}' \
	"$BASE/api/validate")"
printf '%s' "$VALIDATE" | grep -q '"source":"glance"' || fail "no Glance issue in $VALIDATE"

echo "→ PUT /api/config changes the file"
curl -fsS -b "$JAR" -X PUT -H 'Content-Type: application/json' \
	-d "{\"text\":\"# Smoke test config, fake values only.\nserver:\n  assets-path: /assets\ntheme:\n  custom-css-file: /assets/custom.css\npages:\n  - name: Start\n    columns:\n      - size: full\n        widgets:\n          - type: clock\n\",\"baseVersion\":\"$VERSION\"}" \
	"$BASE/api/config" >/dev/null || fail "PUT /api/config failed"
grep -q 'name: Start' "$WORK/config/glance.yml" || fail "glance.yml was not changed"
[ -f "$WORK/config/.glaze/secret" ] || fail "no .glaze/secret was created"

echo "→ web app is served"
curl -fsS "$BASE/" | grep -q '<div id="root">' || fail "index.html not served"

echo "→ image size: $(docker image inspect "$IMAGE" --format '{{.Size}}' | awk '{ printf "%.0f MB", $1 / 1000 / 1000 }')"
echo "OK: smoke test passed"
