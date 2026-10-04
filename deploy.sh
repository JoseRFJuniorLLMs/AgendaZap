#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-${HOME}/agendazap}"
REPO_URL="${REPO_URL:-https://github.com/JoseRFJuniorLLMs/AgendaZap.git}"
BRANCH="${BRANCH:-main}"

FRONT_SERVICE="agendazap"
VOICE_SERVICE="voice-service"
FRONT_IMAGE="agendazap:local"
VOICE_IMAGE="agendazap-voice:local"
FRONT_ROLLBACK="agendazap:rollback"
VOICE_ROLLBACK="agendazap-voice:rollback"

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

if docker image inspect "$FRONT_IMAGE" >/dev/null 2>&1; then
  docker tag "$FRONT_IMAGE" "$FRONT_ROLLBACK"
fi

if docker image inspect "$VOICE_IMAGE" >/dev/null 2>&1; then
  docker tag "$VOICE_IMAGE" "$VOICE_ROLLBACK"
fi

docker compose build --pull
docker compose up -d --remove-orphans

wait_healthy() {
  service="$1"
  container_id="$(docker compose ps -q "$service")"

  if [ -z "$container_id" ]; then
    echo "Container $service não foi criado." >&2
    return 1
  fi

  attempt=0
  while [ "$attempt" -lt 45 ]; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"

    if [ "$status" = "healthy" ]; then
      return 0
    fi

    if [ "$status" = "unhealthy" ] || [ "$status" = "exited" ] || [ "$status" = "dead" ]; then
      echo "$service ficou $status." >&2
      return 1
    fi

    attempt=$((attempt + 1))
    sleep 2
  done

  echo "Timeout aguardando healthcheck de $service." >&2
  return 1
}

rollback() {
  restored=0

  if docker image inspect "$FRONT_ROLLBACK" >/dev/null 2>&1; then
    docker tag "$FRONT_ROLLBACK" "$FRONT_IMAGE"
    restored=1
  fi

  if docker image inspect "$VOICE_ROLLBACK" >/dev/null 2>&1; then
    docker tag "$VOICE_ROLLBACK" "$VOICE_IMAGE"
    restored=1
  fi

  if [ "$restored" -eq 1 ]; then
    echo "Restaurando imagens anteriores..." >&2
    docker compose up -d --no-build --remove-orphans || true
  fi
}

if ! wait_healthy "$VOICE_SERVICE"; then
  docker compose logs --tail=120 "$VOICE_SERVICE" >&2 || true
  rollback
  exit 1
fi

if ! wait_healthy "$FRONT_SERVICE"; then
  docker compose logs --tail=120 "$FRONT_SERVICE" >&2 || true
  rollback
  exit 1
fi

front_id="$(docker compose ps -q "$FRONT_SERVICE")"
voice_id="$(docker compose ps -q "$VOICE_SERVICE")"

if ! docker exec "$front_id" wget -q -O - http://127.0.0.1/healthz | grep -q '^ok$'; then
  echo "Health endpoint do frontend inválido." >&2
  rollback
  exit 1
fi

if ! docker exec "$voice_id" node -e "fetch('http://127.0.0.1:3001/healthz').then(async r=>{if(!r.ok)process.exit(1); const j=await r.json(); if(!j.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
  echo "Health endpoint do Voice AI inválido." >&2
  rollback
  exit 1
fi

docker image prune -f >/dev/null 2>&1 || true

echo "AgendaZap publicado: frontend e Voice AI saudáveis."
docker compose ps
