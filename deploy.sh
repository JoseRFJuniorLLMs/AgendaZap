#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/agendazap}"
REPO_URL="${REPO_URL:-https://github.com/JoseRFJuniorLLMs/AgendaZap.git}"
BRANCH="${BRANCH:-main}"

if ! command -v git >/dev/null 2>&1; then
  echo "git não encontrado" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker não encontrado" >&2
  exit 1
fi

mkdir -p "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"
docker compose up -d --build --remove-orphans
docker image prune -f

echo "AgendaZap publicado."
docker compose ps
