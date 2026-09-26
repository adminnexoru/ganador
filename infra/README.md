# Infraestructura

Un solo servidor (research R9) con Docker Compose: PostgreSQL/PostGIS, Traccar, API, servidor
web de Expo, Caddy (HTTPS) y respaldos.

## Arranque

```bash
cp .env.example .env            # completar secretos
docker compose -f infra/docker-compose.yml --env-file .env --profile server up -d --build
docker compose -f infra/docker-compose.yml exec api pnpm db:migrate
```

DNS de `nexoru.ai` hacia la IP del servidor: `ganador`, `api.ganador` y `track.ganador`.
Caddy obtiene los certificados solo.

Puertos públicos: 80/443 (Caddy) y 5023 (GT06, sin cifrado, aceptado bajo la regla
"Transporte desde el hardware" de la constitución v1.1.0). OsmAnd/Traccar Client entra por
`https://track.ganador.nexoru.ai`; el 5055 no se publica.

## Disponibilidad y monitoreo

- **Objetivo**: 99.5 % mensual de la API (≈ 3 h 36 min de caída al mes).
- **Chequeo externo cada minuto** a `https://api.ganador.nexoru.ai/health` con un servicio de
  monitoreo (p. ej. UptimeRobot o Better Stack, plan gratuito). `200` = todo bien; `503` =
  la base de datos o Traccar no responden. Configurar alerta al equipo por correo o WhatsApp
  tras 2 fallas seguidas.
- **Registros**: la API escribe JSON (pino) sin IP ni agente de usuario
  (`docker compose logs api`). Caddy no escribe registros de acceso.
- **Tiempos reales** (SC-001, SC-003): `pnpm --filter @ganador/api timings-report`.

## Respaldos

`infra/backup/backup.sh` respalda cada 24 h las bases `ganador` y `traccar`, cifradas con
AES-256 (`BACKUP_PASSPHRASE`), en el bucket S3 y conserva 30 días. Guarda la frase fuera del
servidor: sin ella no se puede restaurar. Instrucciones de restauración en el propio script.

Probar la restauración al menos una vez al mes en un servidor aparte.
