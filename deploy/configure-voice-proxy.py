#!/usr/bin/env python3
"""Provision a proxy credential without changing provider/model settings."""
import os
import re
import secrets
import sys
from pathlib import Path

env = Path(sys.argv[1] if len(sys.argv) > 1 else '/etc/agendazap-voice.env')
snippet = Path(sys.argv[2] if len(sys.argv) > 2 else '/etc/nginx/snippets/agendazap-voice-secret.conf')
text = env.read_text() if env.exists() else 'VOICE_PORT=3001\nVOICE_DATA_DIR=/app/data\n'
match = re.search(r'^VOICE_SHARED_SECRET=(.*)$', text, re.M)
secret = match.group(1).strip().strip('"\'') if match else ''
if not secret:
    secret = secrets.token_hex(32)
if not re.fullmatch(r'[a-zA-Z0-9_-]{16,256}', secret):
    raise SystemExit('VOICE_SHARED_SECRET must contain 16-256 ASCII letters/digits/_/-')
line = 'VOICE_SHARED_SECRET=' + secret
text = re.sub(r'^VOICE_SHARED_SECRET=.*$', line, text, flags=re.M) if match else text.rstrip() + '\n' + line + '\n'
for target, value in [(env, text), (snippet, f'proxy_set_header X-AgendaZap-Secret "{secret}";\n')]:
    temp = target.with_name(target.name + '.tmp')
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write(value)
    os.chmod(temp, 0o600)
    os.replace(temp, target)
