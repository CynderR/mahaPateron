#!/bin/bash

# Pull latest code, rebuild the React app, and restart production services.
# Run on the Debian server — do NOT use ./start-dev.sh for production updates.
#
# Usage:
#   cd /var/www/user-management-app && ./update-production.sh
#   NODE_VERSION=22.21.0 ./update-production.sh   # override Node if needed

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

NODE_VERSION="${NODE_VERSION:-22.21.0}"
RELOAD_NGINX="${RELOAD_NGINX:-1}"
GIT_BRANCH="${GIT_BRANCH:-main}"

echo "🔄 Updating Shyam Akaash production app..."
echo "=================================================="

# Node.js (CRA build needs a modern runtime; server default is 22.21.0 via nvm)
if [ -f "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  source "$HOME/.nvm/nvm.sh"
  print_status "Using Node.js ${NODE_VERSION} (set NODE_VERSION to override)"
  nvm use "$NODE_VERSION"
else
  print_warning "nvm not found — using system node: $(node -v 2>/dev/null || echo unknown)"
fi

ensure_repo_ownership() {
  if git status >/dev/null 2>&1; then
    return 0
  fi
  print_warning "Git cannot use this repo as $(whoami) (often caused by www-data ownership from an old deploy)."
  print_status "Fixing ownership on $SCRIPT_DIR ..."
  sudo chown -R "$(whoami):$(whoami)" "$SCRIPT_DIR"
}

ensure_repo_ownership

print_status "Pulling latest code (origin/${GIT_BRANCH})..."
git pull origin "$GIT_BRANCH"

# Leftover nodemon from ./start-dev.sh watches node_modules and fights pm2 on port 5000.
print_status "Stopping stray dev processes (nodemon)..."
pkill -f "nodemon server.js" 2>/dev/null || true

print_status "Installing frontend dependencies..."
npm install

print_status "Installing backend dependencies..."
(cd backend && npm install --omit=dev)

build_frontend() {
  local backup_dir=""
  if [ -f build/index.html ]; then
    backup_dir="$(mktemp -d)"
    print_status "Backing up current build to $backup_dir ..."
    cp -a build "$backup_dir/"
  fi

  print_status "Building React app (homepage /shyam_akaash)..."
  # Webhook shells may set CI=1, which turns ESLint warnings into build failures.
  if ! CI=false npm run build; then
    if [ -n "$backup_dir" ] && [ -f "$backup_dir/build/index.html" ]; then
      print_warning "Build failed — restoring previous build so the site stays online"
      rm -rf build
      cp -a "$backup_dir/build" .
    fi
    rm -rf "$backup_dir"
    print_error "Frontend build failed"
    return 1
  fi

  rm -rf "$backup_dir"

  if ! ls build/static/js/main.*.js >/dev/null 2>&1; then
    print_error "Build finished but main.*.js is missing"
    return 1
  fi
  if [ ! -f build/index.html ]; then
    print_error "Build finished but build/index.html is missing"
    return 1
  fi
}

build_frontend

print_status "Verifying nginx static serving..."
if [ "$RELOAD_NGINX" = "1" ]; then
  bash "$SCRIPT_DIR/fix-nginx.sh"
else
  ln -sfn "$SCRIPT_DIR/build" "$SCRIPT_DIR/shyam_akaash"
  print_warning "Skipped nginx MIME check (RELOAD_NGINX=0)"
fi

pm2_restart_or_start() {
  local name="$1"
  if pm2 describe "$name" >/dev/null 2>&1; then
    pm2 restart "$name" --update-env
  else
    print_warning "PM2 process '$name' not found — starting from ecosystem.config.js"
    pm2 start "$SCRIPT_DIR/ecosystem.config.js" --only "$name"
    pm2 save
  fi
}

print_status "Restarting production backend (pm2)..."
pm2_restart_or_start user-management-backend

echo ""
echo "=================================================="
print_status "Verification"
echo "=================================================="

print_status "Build output:"
ls -la build/ | head -20

if ls build/static/js/main.*.js >/dev/null 2>&1; then
  print_status "JS bundle: $(ls build/static/js/main.*.js)"
else
  print_error "No main.*.js in build/static/js/ — build may have failed"
  exit 1
fi

print_status "syam_akaash symlink:"
ls -la shyam_akaash

echo ""
print_status "PM2 status:"
pm2 status

echo ""
print_status "Recent backend logs (non-streaming):"
pm2 logs user-management-backend --lines 10 --nostream

echo ""
print_status "API health:"
if curl -sf http://localhost:5000/api/health; then
  echo ""
else
  print_error "Health check failed — run: pm2 logs user-management-backend --lines 50"
  exit 1
fi

echo ""
print_status "✅ Production update complete"
echo "Site: https://4thstate.ca/shyam_akaash"
