#!/usr/bin/env bash
# Run as root. Builds are isolated; the durable deployed SHA changes only after health.
set -Eeuo pipefail
exec 9>/var/lock/agendazap-deploy.lock
flock -n 9 || exit 0
APP=/home/web2a/AgendaZap
STATE=/var/lib/agendazap-deploy
VOICE_ENV=/etc/agendazap-voice.env
API_ENV=/etc/agendazap.env
NGINX=/etc/nginx/snippets/nginx-agendazap.conf
SECRET=/etc/nginx/snippets/agendazap-voice-secret.conf
UNIT=/etc/systemd/system/agendazap.service
mkdir -p "$STATE" /home/web2a/backups/agendazap-ci
test -d "$APP/.git" # Initial installations use deploy/install.sh.
sudo -u web2a git -C "$APP" fetch origin main
SHA=$(sudo -u web2a git -C "$APP" rev-parse origin/main)
PREV=$(cat "$STATE/deployed-sha")
health() { curl --max-time 5 -fsS http://127.0.0.1:8793/AgendaZap/api/health | grep -q '"status":"ok"' && curl --max-time 5 -fsS http://127.0.0.1:8794/healthz | grep -q '"ok":true'; }
if [ "$SHA" = "$PREV" ]; then health; exit; fi
if [ "$SHA" = "$(cat "$STATE/failed-sha" 2>/dev/null || true)" ]; then echo "Blocked previously failed revision $SHA"; exit 0; fi
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
STAGE=/home/web2a/agendazap-stage-$SHA
BACKUP=/home/web2a/backups/agendazap-ci/$STAMP-$PREV
mkdir -m 700 "$BACKUP"
mkdir -p "$STAGE"
CHANGED=0
OLD_VOICE=0
NEW_DEPS=0
FILES=("$API_ENV" "$VOICE_ENV" "$NGINX" "$SECRET" "$UNIT")
for i in "${!FILES[@]}"; do if [ -f "${FILES[$i]}" ]; then cp -p "${FILES[$i]}" "$BACKUP/config-$i"; fi; done
cleanup_candidate() { docker rm -f agendazap-voice-candidate >/dev/null 2>&1 || true; }
rollback() {
  local code=$?
  trap - ERR INT TERM
  set +e
  cleanup_candidate
  if [ "$CHANGED" = 1 ]; then
    echo "Restoring AgendaZap revision $PREV" >&2
    systemctl stop agendazap.service
    if [ -d "$BACKUP/code" ]; then rsync -ac --delete --exclude=.git --exclude=data --exclude=node_modules --exclude=.env "$BACKUP/code/" "$APP/"; fi
    if [ "$NEW_DEPS" = 1 ]; then mv "$APP/node_modules" "$BACKUP/failed-node_modules"; mv "$BACKUP/node_modules" "$APP/node_modules"; fi
    for i in "${!FILES[@]}"; do if [ -f "$BACKUP/config-$i" ]; then cp -p "$BACKUP/config-$i" "${FILES[$i]}"; else rm -f "${FILES[$i]}"; fi; done
    sudo -u web2a git -C "$APP" reset --mixed "$PREV"
    if [ "$OLD_VOICE" = 1 ]; then docker rm -f agendazap-voice >/dev/null 2>&1; docker rename agendazap-voice-rollback agendazap-voice; docker start agendazap-voice; fi
    systemctl daemon-reload
    systemctl restart agendazap.service
    if nginx -t; then systemctl reload nginx; fi
    printf '%s\n' "$PREV" > "$STATE/deployed-sha"
    health || echo 'Rollback health failed; inspect services and preserved backup' >&2
  fi
  printf '%s\n' "$SHA" > "$STATE/failed-sha"
  echo "Deploy failed; revision blocked; diagnostics: $BACKUP" >&2
  if [ "$code" = 0 ]; then code=1; fi
  exit "$code"
}
trap rollback ERR INT TERM
sudo -u web2a git -C "$APP" archive "$SHA" | tar -x -C "$STAGE"
chown -R web2a:web2a "$STAGE"
cd "$STAGE"
sudo -u web2a npm ci --no-audit --no-fund
sudo -u web2a npm ci --prefix voice-service --no-audit --no-fund
sudo -u web2a npm run check
sudo -u web2a npm test
docker build -t "agendazap-voice:$SHA" voice-service
cleanup_candidate
docker run -d --name agendazap-voice-candidate --env-file "$VOICE_ENV" -p 127.0.0.1:8795:3001 "agendazap-voice:$SHA" >/dev/null
candidate_ok=0
for attempt in $(seq 1 20); do if curl --max-time 3 -fsS http://127.0.0.1:8795/healthz >/dev/null; then candidate_ok=1; break; fi; sleep 1; done
test "$candidate_ok" = 1
# Probe real audio duration in the built image (host ffprobe is unnecessary).
docker exec agendazap-voice-candidate sh -c 'ffmpeg -v error -f lavfi -i anullsrc=r=8000:cl=mono -t 1 /tmp/probe.wav && node --input-type=module -e '\''import {audioDurationMs} from "./src/audio.js";if(await audioDurationMs("/tmp/probe.wav")!==1000)process.exit(1)'\'''
cleanup_candidate
mkdir "$BACKUP/code"
rsync -a --exclude=.git --exclude=data --exclude=node_modules --exclude=.env "$APP/" "$BACKUP/code/"
CHANGED=1
python3 deploy/configure-voice-proxy.py
# Append only this revision setting; preserve database and provider credentials.
sed -i '/^APP_REVISION=/d' "$API_ENV"
printf '\nAPP_REVISION=%s\n' "$SHA" >> "$API_ENV"
install -m 0644 deploy/nginx-agendazap.conf "$NGINX"
nginx -t # Validate before reloading shared nginx or replacing running application.
systemctl stop agendazap.service
mv "$APP/node_modules" "$BACKUP/node_modules"
NEW_DEPS=1
rsync -ac --delete --exclude=.git --exclude=data --exclude=node_modules --exclude=.env "$STAGE/" "$APP/"
mv "$STAGE/node_modules" "$APP/node_modules"
sudo -u web2a git -C "$APP" reset --mixed "$SHA"
install -m 0644 deploy/agendazap.service "$UNIT"
systemctl daemon-reload
docker rename agendazap-voice agendazap-voice-rollback
OLD_VOICE=1
docker stop agendazap-voice-rollback >/dev/null
docker run -d --name agendazap-voice --restart unless-stopped --env-file "$VOICE_ENV" -p 127.0.0.1:8794:3001 -v agendazap_voice-data:/app/data "agendazap-voice:$SHA" >/dev/null
systemctl restart agendazap.service
systemctl reload nginx
ok=0
for attempt in $(seq 1 30); do
  if health && curl --max-time 5 -fsS http://127.0.0.1:8793/AgendaZap/api/health | grep -q "\"revision\":\"$SHA\""; then ok=1; break; fi
  sleep 2
done
test "$ok" = 1
printf '%s\n' "$SHA" > "$STATE/deployed-sha.tmp"
mv "$STATE/deployed-sha.tmp" "$STATE/deployed-sha"
rm -f "$STATE/failed-sha"
trap - ERR INT TERM
docker rm agendazap-voice-rollback >/dev/null
echo "AgendaZap deployed: $SHA; rollback backup: $BACKUP"
