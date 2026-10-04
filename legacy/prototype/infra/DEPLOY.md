# Deploy do AgendaZap em VM

O frontend atual é estático e é servido por Nginx dentro de Docker.

## Requisitos da VM

- Linux
- Git
- Docker Engine
- Docker Compose Plugin
- porta HTTP liberada

## Deploy inicial

```bash
sudo mkdir -p /opt/agendazap
sudo chown "$USER":"$USER" /opt/agendazap

git clone https://github.com/JoseRFJuniorLLMs/AgendaZap.git /opt/agendazap
cd /opt/agendazap

docker compose up -d --build
```

Por padrão o AgendaZap fica disponível em:

```text
http://IP_DA_VM:8080
```

Para usar outra porta:

```bash
AGENDAZAP_PORT=80 docker compose up -d --build
```

## Atualização

```bash
cd /opt/agendazap
git pull --ff-only origin main
docker compose up -d --build --remove-orphans
```

Ou:

```bash
chmod +x deploy.sh
./deploy.sh
```

## Health check

```text
GET /healthz
```

Deve retornar:

```text
ok
```

## Produção com domínio

Para HTTPS em produção, colocar Caddy, Traefik ou Nginx externo como reverse proxy e emitir certificado TLS para o domínio do AgendaZap.


## Voice AI

O Docker Compose sobe dois serviços:

- `agendazap`: frontend/Nginx;
- `voice-service`: STT/TTS/Live Gemini.

Antes do deploy com voz real:

```bash
cp .env.example .env
```

Preencha:

```text
GEMINI_API_KEY=...
VOICE_SHARED_SECRET=...
```

Depois:

```bash
docker compose up -d --build
```

Health checks:

```bash
curl http://127.0.0.1:8080/healthz
docker compose exec voice-service node -e "fetch('http://127.0.0.1:3001/healthz').then(r=>r.text()).then(console.log)"
```

Sem `GEMINI_API_KEY`, a interface continua funcionando em modo demo, mas STT/TTS real retorna indisponível.

### Segurança

`VOICE_SHARED_SECRET` protege a API do Voice Service quando ele for chamado por serviços internos. O frontend atual é uma demonstração e ainda não possui o sistema definitivo de login/RBAC. Antes de expor operações de voz pagas para clientes reais, o gateway do AgendaZap deve autenticar o usuário/tenant e repassar as chamadas internamente.
