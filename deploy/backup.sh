#!/bin/sh
# Nightly backup used by the `backup` service in docker-compose.yml.
# Keeps the last $KEEP database dumps and $KEEP_MEDIA media archives.
set -eu
KEEP="${KEEP:-30}"
KEEP_MEDIA="${KEEP_MEDIA:-7}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p /backups
pg_dump --no-owner --no-privileges | gzip > "/backups/smartstart-db-${STAMP}.sql.gz"
echo "$(date) DB zaxirasi: smartstart-db-${STAMP}.sql.gz"
if [ -d /media ]; then
  tar -czf "/backups/smartstart-media-${STAMP}.tar.gz" -C / media
  echo "$(date) Media zaxirasi: smartstart-media-${STAMP}.tar.gz"
fi
ls -1t /backups/smartstart-db-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
ls -1t /backups/smartstart-media-*.tar.gz 2>/dev/null | tail -n +"$((KEEP_MEDIA + 1))" | xargs -r rm -f
