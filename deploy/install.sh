#!/usr/bin/env bash
set -euo pipefail
cd /home/web2a/AgendaZap
mkdir -p data /home/web2a/backups
chmod 700 data
if [[ ! -f /etc/agendazap.env ]]; then
  envfile=$(mktemp)
  cat > "$envfile" <<'ENV'
HOST=127.0.0.1
PORT=8793
BASE_PATH=/AgendaZap
PUBLIC_ORIGIN=https://35.247.217.66.nip.io
COOKIE_SECURE=true
DATABASE_URL=postgresql://agendazap:CHANGE_ME@127.0.0.1:5432/agendazap
DATABASE_SCHEMA=agendazap
DATA_DIR=/home/web2a/AgendaZap/data
BACKUP_KEY_FILE=/etc/agendazap-backup.key
ENV
  sudo install -m 600 -o web2a -g web2a "$envfile" /etc/agendazap.env
  rm "$envfile"
fi
if [[ ! -f /etc/agendazap-backup.key ]]; then
  keyfile=$(mktemp)
  openssl rand -hex 32 > "$keyfile"
  sudo install -m 600 -o web2a -g web2a "$keyfile" /etc/agendazap-backup.key
  rm "$keyfile"
fi
if ! sudo grep -q '^BACKUP_KEY_FILE=' /etc/agendazap.env; then
  echo 'BACKUP_KEY_FILE=/etc/agendazap-backup.key' | sudo tee -a /etc/agendazap.env >/dev/null
fi
sudo install -m 644 deploy/agendazap.service /etc/systemd/system/agendazap.service
sudo install -m 644 deploy/nginx-agendazap.conf /etc/nginx/snippets/nginx-agendazap.conf
sudo python3 - <<'PY'
from pathlib import Path
from datetime import datetime,timezone
p=Path('/etc/nginx/sites-available/memoria-nipio')
content=p.read_text()
line='    include /etc/nginx/snippets/nginx-agendazap.conf;'
if line not in content:
    marker='    # vibz-admin\n    include /etc/nginx/snippets/nginx-https.conf;'
    if content.count(marker)!=1:
        raise SystemExit('Expected HTTPS insertion point was not unique; no configuration changed')
    backup=Path('/home/web2a/backups')/('memoria-nipio-before-agendazap-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.conf')
    backup.write_text(content)
    p.write_text(content.replace(marker,line+'\n'+marker))
PY
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now agendazap
sudo systemctl reload nginx
curl --retry 5 --retry-delay 2 --retry-connrefused -fsS http://127.0.0.1:8793/AgendaZap/api/health
echo
sudo systemctl is-active agendazap

