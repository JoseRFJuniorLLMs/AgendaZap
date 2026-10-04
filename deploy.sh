#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-${HOME}/agendazap}"
REPO_URL="${REPO_URL:-https://github.com/JoseRFJuniorLLMs/AgendaZap.git}"
BRANCH="${BRANCH:-main}"
SERVICE="${SERVICE:-agendazap}"
IMAGE="${IMAGE:-agendazap:local}"
ROLLBACK_IMAGE="${ROLLBACK_IMAGE:-agendazap:rollback}"

for cmd in git docker; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd não encontrado" >&2
    exit 1
  fi
done

mkdir -p "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"

if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker tag "$IMAGE" "$ROLLBACK_IMAGE"
fi

docker compose build --pull
docker compose up -d --remove-orphans

container_id="$(docker compose ps -q "$SERVICE")"
if [ -z "$container_id" ]; then
  echo "Container do AgendaZap não foi criado." >&2
  exit 1
fi

attempt=0
healthy=0
while [ "$attempt" -lt 30 ]; do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    healthy=1
    break
  fi
  if [ "$status" = "unhealthy" ] || [ "$status" = "exited" ] || [ "$status" = "dead" ]; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if [ "$healthy" -ne 1 ]; then
  echo "Deploy falhou: container não ficou saudável." >&2
  docker compose ps >&2 || true
  docker compose logs --tail=100 "$SERVICE" >&2 || true

  if docker image inspect "$ROLLBACK_IMAGE" >/dev/null 2>&1; then
    echo "Restaurando imagem anterior..." >&2
    docker tag "$ROLLBACK_IMAGE" "$IMAGE"
    docker compose up -d --no-build --remove-orphans
  fi
  exit 1
fi

if ! docker exec "$container_id" wget -q -O - http://127.0.0.1/healthz | grep -q '^ok$'; then
  echo "Health endpoint inválido." >&2
  exit 1
fi

docker image prune -f >/dev/null 2>&1 || true

echo "AgendaZap publicado com healthcheck válido."
docker compose ps
