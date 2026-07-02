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
  python3 - "$state" "$message" "$DEPLOY_LOG" "$STATUS_FILE" "$LOG_DIR" <<'PY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

state, message, log_path, status_file, log_dir = sys.argv[1:6]
payload = {
    "state": state,
    "message": message,
    "at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "log": log_path,
}
failure_file = Path(log_dir) / "last-build-failure.json"
if failure_file.is_file():
    try:
        failure = json.loads(failure_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        failure = {}
    if failure.get("buildLog"):
        payload["buildLog"] = failure["buildLog"]
    if failure.get("commit"):
        payload["commit"] = failure["commit"]
    if failure.get("reason"):
        payload["buildError"] = failure["reason"]
with open(status_file, "w", encoding="utf-8") as handle:
    json.dump(payload, handle)
    handle.write("\n")
PY
}

log_line() {
  echo "[$(date -Iseconds)] $1" >> "$LOG_DIR/webhook.log"
}

# #region agent log
debug_log() {
  local hypothesis_id="$1"
  local message="$2"
  local data="${3:-{}}"
  local ts
  ts="$(python3 -c 'import time; print(int(time.time()*1000))')"
  python3 - "$LOG_DIR/debug-4aa1ca.log" "$hypothesis_id" "$message" "$data" "$ts" <<'PY'
import json
import sys
from pathlib import Path

log_file, hypothesis_id, message, data_json, ts = sys.argv[1:6]
try:
    data = json.loads(data_json)
except json.JSONDecodeError:
    data = {"raw": data_json}
line = json.dumps({
    "sessionId": "4aa1ca",
    "hypothesisId": hypothesis_id,
    "location": "trigger-deploy.sh",
    "message": message,
    "data": data,
    "timestamp": int(ts),
})
Path(log_file).parent.mkdir(parents=True, exist_ok=True)
with open(log_file, "a", encoding="utf-8") as handle:
    handle.write(line + "\n")
local_log = Path("/home/j/maha/.cursor/debug-4aa1ca.log")
if local_log.parent.exists():
    with open(local_log, "a", encoding="utf-8") as handle:
        handle.write(line + "\n")
PY
}
# #endregion

ensure_github_ssh() {
  local ssh_dir="${HOME}/.ssh"
  mkdir -p "$ssh_dir"
  chmod 700 "$ssh_dir"

  if [ ! -f "$ssh_dir/known_hosts" ] || ! grep -q '^github\.com' "$ssh_dir/known_hosts" 2>/dev/null; then
    ssh-keyscan -t ed25519,rsa github.com >> "$ssh_dir/known_hosts" 2>/dev/null || true
    chmod 600 "$ssh_dir/known_hosts" 2>/dev/null || true
  fi

  if [ ! -f "$ssh_dir/config" ]; then
    touch "$ssh_dir/config"
    chmod 600 "$ssh_dir/config"
  fi

  if ! grep -q '^Host github\.com' "$ssh_dir/config" 2>/dev/null; then
    cat >> "$ssh_dir/config" <<'EOF'

Host github.com
  CheckHostIP no
  StrictHostKeyChecking accept-new
EOF
    chmod 600 "$ssh_dir/config"
  fi

  export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -o CheckHostIP=no -o StrictHostKeyChecking=accept-new}"
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  write_status "skipped" "Deploy already in progress"
  log_line "Skipped deploy — another run is in progress"
  # #region agent log
  debug_log "H2" "deploy skipped — lock held" "{\"lockFile\":\"$LOCK_FILE\"}"
  # #endregion
  exit 2
fi

write_status "running" "Deploy in progress"
log_line "Deploy started (log: $DEPLOY_LOG)"

# #region agent log
debug_log "H3" "deploy starting" "{\"repoRoot\":\"$REPO_ROOT\",\"home\":\"${HOME:-}\",\"user\":\"${USER:-}\",\"triggerScript\":\"$0\"}"
# #endregion

ensure_github_ssh

# #region agent log
known_hosts_github="missing"
if [ -f "${HOME}/.ssh/known_hosts" ] && grep -q '^github\.com' "${HOME}/.ssh/known_hosts" 2>/dev/null; then
  known_hosts_github="present"
fi
debug_log "H4" "ssh prepared for git pull" "{\"knownHostsGithub\":\"$known_hosts_github\",\"gitSshCommand\":\"${GIT_SSH_COMMAND:-}\"}"
# #endregion

set +e
{
  echo "=== Deploy started $(date -Iseconds) ==="
  echo "=== Debug: HOME=$HOME USER=$USER ==="
  cd "$REPO_ROOT"
  export DEPLOY_LOG_DIR="$LOG_DIR"

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
  # #region agent log
  debug_log "H4" "deploy finished successfully" "{\"exitCode\":0}"
  # #endregion
else
  echo "=== Deploy failed (exit $rc) $(date -Iseconds) ===" >> "$DEPLOY_LOG"
  write_status "failed" "Deploy failed (exit $rc)"
  log_line "Deploy failed with exit code $rc"
  # #region agent log
  tail_hint="$(tail -3 "$DEPLOY_LOG" 2>/dev/null | tr '\n' ' ' | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
  debug_log "H4" "deploy failed" "{\"exitCode\":$rc,\"logTail\":$tail_hint}"
  # #endregion
  exit "$rc"
fi
