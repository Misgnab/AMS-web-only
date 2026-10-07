#!/bin/bash
# ==============================================================================
# BuildTrack AMS — MySQL Database Online Backup Script (mysqldump)
# Nabi Tech PLC | Automated Daily MySQL Backup & Compression Routine
# ==============================================================================

set -e

# Configuration
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PWD="${MYSQL_PASSWORD:-}"
MYSQL_DATABASE="${MYSQL_DATABASE:-buildtrack_ams}"

BACKUP_DIR="/var/backups/buildtrack"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/buildtrack_ams_${TIMESTAMP}.sql"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting BuildTrack AMS MySQL database backup..."

export MYSQL_PWD="${MYSQL_PWD}"

# Execute mysqldump with single transaction for ACID consistency without table locking
if command -v mysqldump >/dev/null 2>&1; then
  mysqldump \
    --host="${MYSQL_HOST}" \
    --port="${MYSQL_PORT}" \
    --user="${MYSQL_USER}" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    --databases "${MYSQL_DATABASE}" > "${BACKUP_FILE}"

  echo "[SUCCESS] MySQL backup created: ${BACKUP_FILE}"
else
  echo "[ERROR] mysqldump utility not found!" >&2
  exit 1
fi

# Compress the backup file to save disk space
if command -v gzip >/dev/null 2>&1; then
  gzip -f "${BACKUP_FILE}"
  echo "[SUCCESS] Compressed backup: ${BACKUP_FILE}.gz"
fi

# Prune backups older than RETENTION_DAYS
echo "[INFO] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "buildtrack_ams_*.sql*" -mtime +${RETENTION_DAYS} -exec rm -f {} \;

echo "[$(date)] MySQL database backup routine completed successfully."
