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
