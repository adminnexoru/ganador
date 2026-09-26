#!/usr/bin/env bash
# Respaldo diario cifrado de PostgreSQL (bases ganador y traccar) a almacenamiento S3
# (research R9, R16). Requiere: pg_dump, openssl, aws (CLI) y las variables:
#   PGHOST PGUSER PGPASSWORD  BACKUP_PASSPHRASE  S3_BUCKET S3_ENDPOINT
#   AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY  [BACKUP_KEEP_DAYS=30]
set -euo pipefail

stamp=$(date -u +%Y%m%dT%H%M%SZ)
keep=${BACKUP_KEEP_DAYS:-30}

for db in ganador traccar; do
  key="backups/${db}/${db}-${stamp}.dump.enc"
  # Formato custom de pg_dump, cifrado con AES-256 antes de salir del servidor.
  pg_dump --format=custom --dbname="$db" \
    | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE \
    | aws s3 cp - "s3://${S3_BUCKET}/${key}" --endpoint-url "$S3_ENDPOINT"
  echo "respaldo ${db} → ${key}"
done

# Borra respaldos más antiguos que BACKUP_KEEP_DAYS.
cutoff=$(date -u -d "-${keep} days" +%Y%m%d)
aws s3 ls "s3://${S3_BUCKET}/backups/" --recursive --endpoint-url "$S3_ENDPOINT" \
  | awk '{print $4}' \
  | while read -r key; do
      day=$(echo "$key" | grep -oE '[0-9]{8}T' | tr -d T || true)
      if [[ -n "$day" && "$day" < "$cutoff" ]]; then
        aws s3 rm "s3://${S3_BUCKET}/${key}" --endpoint-url "$S3_ENDPOINT"
      fi
    done

# Restaurar:
#   aws s3 cp s3://$S3_BUCKET/backups/ganador/<archivo> - --endpoint-url $S3_ENDPOINT \
#     | openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE \
#     | pg_restore --dbname=ganador --clean
