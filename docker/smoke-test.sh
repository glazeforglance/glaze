#!/bin/sh
# Smoke test for the Glaze image: starts it on a temp copy of a fake config
# and checks health, auth, reading, writing and validation with the bundled
# Glance. Never uses .dev/ or real values.
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

cleanup() {
	docker rm -f "$NAME" >/dev/null 2>&1 || true
	rm -rf "$WORK"
}
trap cleanup EXIT

fail() {
	echo "FAIL: $*" >&2
	docker logs "$NAME" 2>&1 | tail -20 >&2 || true
	exit 1
}

mkdir -p "$WORK/config"
cat >"$WORK/config/glance.yml" <<'YAML'
# Smoke test config, fake values only.
pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: clock
YAML

echo "→ hash-password (piped)"
HASH="$(printf '%s\n%s\n' "$PASSWORD" "$PASSWORD" | docker run --rm -i "$IMAGE" hash-password)"
case "$HASH" in scrypt\$*) ;; *) fail "hash-password printed no hash" ;; esac

echo "→ start (as the folder's owner, like compose's user:)"
docker run -d --name "$NAME" \
	--user "$(id -u):$(id -g)" \
	-p "127.0.0.1:$PORT:8090" \
	-v "$WORK/config:/config" \
	-e GLAZE_ADMIN_PASSWORD_HASH="$HASH" \
	"$IMAGE" >/dev/null

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

echo "→ login"
curl -fsS -c "$JAR" -H 'Content-Type: application/json' \
	-d "{\"username\":\"admin\",\"password\":\"$PASSWORD\"}" \
	"$BASE/api/auth/login" >/dev/null || fail "login failed"

echo "→ GET /api/config"
CONFIG="$(curl -fsS -b "$JAR" "$BASE/api/config")" || fail "GET /api/config failed"
VERSION="$(printf '%s' "$CONFIG" | sed -n 's/.*"version":"\([0-9a-f]*\)".*/\1/p')"
[ -n "$VERSION" ] || fail "no version in $CONFIG"

echo "→ POST /api/validate runs Glance (an unknown widget type is a Glance error)"
VALIDATE="$(curl -fsS -b "$JAR" -H 'Content-Type: application/json' \
	-d '{"text":"pages:\n  - name: Home\n    columns:\n      - size: full\n        widgets:\n          - type: no-such-widget\n"}' \
	"$BASE/api/validate")"
printf '%s' "$VALIDATE" | grep -q '"source":"glance"' || fail "no Glance issue in $VALIDATE"

echo "→ PUT /api/config changes the file"
curl -fsS -b "$JAR" -X PUT -H 'Content-Type: application/json' \
	-d "{\"text\":\"# Smoke test config, fake values only.\npages:\n  - name: Start\n    columns:\n      - size: full\n        widgets:\n          - type: clock\n\",\"baseVersion\":\"$VERSION\"}" \
	"$BASE/api/config" >/dev/null || fail "PUT /api/config failed"
grep -q 'name: Start' "$WORK/config/glance.yml" || fail "glance.yml was not changed"
[ -f "$WORK/config/.glaze/secret" ] || fail "no .glaze/secret was created"

echo "→ web app is served"
curl -fsS "$BASE/" | grep -q '<div id="root">' || fail "index.html not served"

echo "→ image size: $(docker image inspect "$IMAGE" --format '{{.Size}}' | awk '{ printf "%.0f MB", $1 / 1000 / 1000 }')"
echo "OK: smoke test passed"
