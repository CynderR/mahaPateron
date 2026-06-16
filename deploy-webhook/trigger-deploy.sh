#!/usr/bin/env bash

# Runs update-production.sh with a lock so overlapping webhook pushes do not
# start multiple deploys at once.

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/var/www/user-management-app}"
LOG_DIR="${DEPLOY_LOG_DIR:-/var/log/deploy-webhook}"
LOCK_FILE="$LOG_DIR/deploy.lock"
STATUS_FILE="$LOG_DIR/last-status.json"
DEPLOY_LOG="$LOG_DIR/deploy-$(date +%Y%m%d_%H%M%S).log"
NODE_VERSION="${NODE_VERSION:-22.21.0}"

# Webhook child processes often lack a login shell — git/ssh need a real HOME.
if [ -z "${HOME:-}" ]; then
  HOME="$(getent passwd "$(whoami)" 2>/dev/null | cut -d: -f6 || true)"
  export HOME
fi
export USER="${USER:-$(whoami)}"
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"

mkdir -p "$LOG_DIR"

write_status() {
  local state="$1"
  local message="$2"
  python3 - "$state" "$message" "$DEPLOY_LOG" "$STATUS_FILE" <<'PY'
import json
import sys
from datetime import datetime, timezone

state, message, log_path, status_file = sys.argv[1:5]
payload = {
    "state": state,
    "message": message,
    "at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "log": log_path,
}
with open(status_file, "w", encoding="utf-8") as handle:
    json.dump(payload, handle)
    handle.write("\n")
PY
}

log_line() {
  echo "[$(date -Iseconds)] $1" >> "$LOG_DIR/webhook.log"
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  write_status "skipped" "Deploy already in progress"
  log_line "Skipped deploy — another run is in progress"
  exit 2
fi

write_status "running" "Deploy in progress"
log_line "Deploy started (log: $DEPLOY_LOG)"

set +e
{
  echo "=== Deploy started $(date -Iseconds) ==="
  cd "$REPO_ROOT"

  if [ -f "${HOME}/.nvm/nvm.sh" ]; then
    # shellcheck source=/dev/null
    source "${HOME}/.nvm/nvm.sh"
    nvm use "$NODE_VERSION"
  fi

  ./update-production.sh
} >> "$DEPLOY_LOG" 2>&1
rc=$?
set -e

if [ "$rc" -eq 0 ]; then
  echo "=== Deploy finished $(date -Iseconds) ===" >> "$DEPLOY_LOG"
  write_status "success" "Deploy completed"
  log_line "Deploy finished successfully"
else
  echo "=== Deploy failed (exit $rc) $(date -Iseconds) ===" >> "$DEPLOY_LOG"
  write_status "failed" "Deploy failed (exit $rc)"
  log_line "Deploy failed with exit code $rc"
  exit "$rc"
fi
