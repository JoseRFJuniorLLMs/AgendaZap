#!/usr/bin/env bash
set -euo pipefail
cd /home/web2a/AgendaZap-postgresql-stage
npm ci --omit=dev
python3 deploy/provision-postgresql.py
set -a
source ./postgresql.env
set +a
node scripts/persistence-check.js
# Preserve old application and env for rollback before the short cutover.
mkdir -p /home/web2a/backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
tar --exclude=node_modules --exclude=data -czf /home/web2a/backups/agendazap-before-postgresql-$stamp.tgz -C /home/web2a/AgendaZap .
cp /etc/agendazap.env /home/web2a/backups/agendazap-before-postgresql-$stamp.env
chmod 600 /home/web2a/backups/agendazap-before-postgresql-$stamp.env
sudo systemctl stop agendazap
old_deps=/home/web2a/backups/agendazap-before-postgresql-$stamp.node_modules
changed=0
rollback() {
  trap - ERR
  set +e
  if [ "$changed" = 1 ]; then
    restore=/home/web2a/backups/agendazap-restore-$stamp
    mkdir -p "$restore"
    tar -xzf /home/web2a/backups/agendazap-before-postgresql-$stamp.tgz -C "$restore"
    rsync -ac --delete --exclude=.git --exclude=data --exclude=node_modules "$restore/" /home/web2a/AgendaZap/
    sudo install -m 600 -o web2a -g web2a /home/web2a/backups/agendazap-before-postgresql-$stamp.env /etc/agendazap.env
    if [ -d "$old_deps" ]; then mv /home/web2a/AgendaZap/node_modules /home/web2a/backups/agendazap-failed-$stamp.node_modules; mv "$old_deps" /home/web2a/AgendaZap/node_modules; fi
  fi
  sudo systemctl start agendazap
  exit 1
}
trap rollback ERR
cd /home/web2a/AgendaZap
set -a
source /etc/agendazap.env
set +a
node --input-type=module <<'NODE'
import {Store} from './src/store.js';
import {saveBackup} from './src/backup.js';
import {writeFileSync} from 'node:fs';
const store=new Store();await store.init();
try{const file=saveBackup(store.state);if(!file)throw new Error('Encrypted backup required');writeFileSync('/home/web2a/AgendaZap-postgresql-stage/migration-backup-path',file,{mode:0o600});}finally{store.close();}
NODE
cd /home/web2a/AgendaZap-postgresql-stage
set -a
source ./postgresql.env
set +a
export DATABASE_SCHEMA=agendazap_migration
node scripts/restore-backup.js --isolated-empty-target "$(cat migration-backup-path)"
node --input-type=module <<'NODE'
import {Store} from './src/store.js';
import {readFileSync} from 'node:fs';
import {decryptSnapshot} from './src/backup.js';
const snapshot=decryptSnapshot(readFileSync(readFileSync('migration-backup-path','utf8')),Buffer.from(readFileSync(process.env.BACKUP_KEY_FILE,'utf8').trim(),'hex'));
for(const session of Object.values(snapshot.state.sessions))session.revoked=true;
const store=new Store();await store.init();
try{
 if(JSON.stringify(store.state)!==JSON.stringify(snapshot.state)){
  // jsonb canonicalizes object key order; compare recursively sorted objects.
  const normalize=x=>Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,normalize(x[k])])):x;
  if(JSON.stringify(normalize(store.state))!==JSON.stringify(normalize(snapshot.state)))throw new Error('Full migration state comparison failed');
 }
 const existing=await store.client.query("SELECT 1 FROM pg_namespace WHERE nspname='agendazap'");
 if(existing.rowCount)throw new Error('Production schema already exists; refusing overwrite');
 await store.client.query('ALTER SCHEMA agendazap_migration RENAME TO agendazap');
 console.log('PASS complete migrated state comparison; sessions revoked');
}finally{await store.close();}
NODE
# Only AgendaZap application files are overlaid. Data and unrelated services stay intact.
tar --exclude=node_modules --exclude=postgresql.env --exclude=migration-backup-path -cf /home/web2a/AgendaZap-postgresql-stage/cutover.tar src public scripts deploy docs package.json package-lock.json
changed=1
mv /home/web2a/AgendaZap/node_modules "$old_deps"
cp -a node_modules /home/web2a/AgendaZap/node_modules
tar -xf cutover.tar -C /home/web2a/AgendaZap
cd /home/web2a/AgendaZap
sudo install -m 600 -o web2a -g web2a /home/web2a/AgendaZap-postgresql-stage/postgresql.env /etc/agendazap.env
sudo systemctl start agendazap
curl --retry 10 --retry-delay 2 --retry-connrefused -fsS http://127.0.0.1:8793/AgendaZap/api/health
trap - ERR
