#!/usr/bin/env bash

# One-time (or repeat-safe) setup for the GitHub deploy webhook on the server.
#
# Usage:
#   cd /var/www/user-management-app
#   ./scripts/setup-deploy-webhook.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

ENV_FILE="$REPO_ROOT/deploy-webhook/.env"
ENV_EXAMPLE="$REPO_ROOT/deploy-webhook/.env.example"
LOG_DIR="/var/log/deploy-webhook"
HOST_HEADER="${HOST_HEADER:-4thstate.ca}"

print_status "Preparing deploy webhook files..."
chmod +x "$REPO_ROOT/deploy-webhook/trigger-deploy.sh"
sudo mkdir -p "$LOG_DIR"
sudo chown "$(whoami):$(whoami)" "$LOG_DIR"
touch "$LOG_DIR/webhook.log"

if [ ! -f "$ENV_FILE" ]; then
  print_status "Creating deploy-webhook/.env with a new webhook secret..."
  SECRET="$(openssl rand -hex 32)"
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  sed -i "s/^GITHUB_WEBHOOK_SECRET=.*/GITHUB_WEBHOOK_SECRET=$SECRET/" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  print_warning "Saved secret to $ENV_FILE — you will need this for GitHub."
else
  print_status "Using existing $ENV_FILE"
  SECRET="$(grep '^GITHUB_WEBHOOK_SECRET=' "$ENV_FILE" | cut -d= -f2-)"
fi

if [ -z "$SECRET" ]; then
  print_error "GITHUB_WEBHOOK_SECRET is empty in $ENV_FILE"
  exit 1
fi

print_status "Patching nginx to expose /hooks/github-deploy..."
sudo python3 "$REPO_ROOT/scripts/patch-nginx-deploy-webhook.py"
sudo nginx -t
sudo systemctl reload nginx

print_status "Starting deploy-webhook with PM2..."
if pm2 describe deploy-webhook >/dev/null 2>&1; then
  pm2 restart deploy-webhook --update-env
else
  pm2 start "$REPO_ROOT/ecosystem.config.js" --only deploy-webhook
fi
pm2 save

print_status "Health check (local listener):"
if curl -sf "http://127.0.0.1:9000/health"; then
  echo ""
else
  print_error "deploy-webhook is not responding on 127.0.0.1:9000"
  print_error "Run: pm2 logs deploy-webhook --lines 30"
  exit 1
fi

print_status "Health check (via nginx / HTTPS):"
HTTPS_STATUS="$(curl -sk -o /dev/null -w '%{http_code}' "https://127.0.0.1/hooks/github-deploy/status" -H "Host: $HOST_HEADER")"
if [ "$HTTPS_STATUS" = "200" ]; then
  curl -sk "https://127.0.0.1/hooks/github-deploy/status" -H "Host: $HOST_HEADER"
  echo ""
else
  print_error "nginx returned HTTP $HTTPS_STATUS for /hooks/github-deploy/status"
  echo ""
  echo "Debug:"
  echo "  sudo nginx -T | grep -A8 'hooks/github-deploy'"
  echo "  pm2 status"
  echo "  curl -s http://127.0.0.1:9000/hooks/github-deploy/status"
  exit 1
fi

echo ""
echo "=================================================="
print_status "GitHub webhook setup"
echo "=================================================="
echo "1. Repo → Settings → Webhooks → Add webhook"
echo "2. Payload URL: https://4thstate.ca/hooks/github-deploy"
echo "3. Content type: application/json"
echo "4. Secret: (value from deploy-webhook/.env)"
echo "5. Events: Just the push event"
echo ""
echo "Webhook secret (also in deploy-webhook/.env):"
echo "$SECRET"
echo ""
echo "After saving the webhook, push to main and watch:"
echo "  tail -f /var/log/deploy-webhook/webhook.log"
echo "  curl -s https://4thstate.ca/hooks/github-deploy/status"
echo ""
print_status "Setup complete"
