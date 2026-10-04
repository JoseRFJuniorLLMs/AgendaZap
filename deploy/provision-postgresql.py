#!/usr/bin/env python3
import subprocess,secrets,pathlib

def sql(query,db='postgres'):
    return subprocess.check_output(['sudo','-u','postgres','psql','-X','-v','ON_ERROR_STOP=1','-At','-d',db,'-c',query],text=True).strip()
if sql("SELECT count(*) FROM pg_roles WHERE rolname='agendazap'")!='0' or sql("SELECT count(*) FROM pg_database WHERE datname='agendazap'")!='0':
    raise SystemExit('AgendaZap role/database already exist; refusing credential overwrite')
password=secrets.token_hex(32)
sql("CREATE ROLE agendazap LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '"+password+"'")
sql('CREATE DATABASE agendazap OWNER agendazap')
p=pathlib.Path('/etc/agendazap.env')
content=p.read_text()
content='\n'.join(line for line in content.splitlines() if not line.startswith(('HERACLITUS_','DATABASE_')))+'\n'
content+='DATABASE_URL=postgresql://agendazap:'+password+'@127.0.0.1:5432/agendazap\nDATABASE_SCHEMA=agendazap\n'
# Stage credentials; production env is switched only after state restore succeeds.
staged=pathlib.Path('/home/web2a/AgendaZap-postgresql-stage/postgresql.env')
staged.write_text(content);staged.chmod(0o600)
print('Created isolated AgendaZap PostgreSQL database and staged private environment')
