#!/bin/bash

# Ensure the shyam_akaash symlink exists and nginx serves JS/CSS with the correct
# MIME type. Run on the server after git pull:
#   ./fix-nginx.sh

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

NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/user-management-app}"
HOST_HEADER="${HOST_HEADER:-4thstate.ca}"

print_status "Linking build/ → shyam_akaash/ (required for root+try_files)..."
ln -sfn "$SCRIPT_DIR/build" "$SCRIPT_DIR/shyam_akaash"

if ! ls build/static/js/main.*.js >/dev/null 2>&1; then
  print_error "No build/static/js/main.*.js — run npm run build first"
  exit 1
fi

MAIN_JS="$(basename "$(ls build/static/js/main.*.js | head -1)")"
print_status "JS bundle on disk: shyam_akaash/static/js/$MAIN_JS"

if [ ! -f "shyam_akaash/static/js/$MAIN_JS" ]; then
  print_error "Symlink broken — shyam_akaash/static/js/$MAIN_JS not found"
  exit 1
fi

if [ ! -f "$NGINX_SITE" ]; then
  print_warning "nginx site file not found at $NGINX_SITE"
else
  if grep -q 'alias /var/www/user-management-app/build' "$NGINX_SITE" 2>/dev/null \
     && ! grep -q 'location \^~ /shyam_akaash/static/' "$NGINX_SITE" 2>/dev/null; then
    print_error "nginx still uses the old alias+try_files config (serves HTML for .js files)."
    echo ""
    echo "Edit as root: sudo nano $NGINX_SITE"
    echo "Replace the old location /shyam_akaash { alias ... } block with:"
    echo ""
    cat "$SCRIPT_DIR/config/nginx-frontend-locations.conf"
    echo ""
    exit 1
  fi

  if ! grep -q 'root /var/www/user-management-app' "$NGINX_SITE" 2>/dev/null \
     && ! grep -q 'location \^~ /shyam_akaash/static/' "$NGINX_SITE" 2>/dev/null; then
    print_warning "Could not confirm nginx frontend config in $NGINX_SITE"
    print_warning "Compare your server block to: config/nginx-frontend-locations.conf"
  fi
fi

print_status "Testing nginx config..."
sudo nginx -t
sudo systemctl reload nginx

print_status "Checking MIME type via local nginx..."
CONTENT_TYPE="$(
  curl -sI -H "Host: $HOST_HEADER" \
    "http://127.0.0.1/shyam_akaash/static/js/$MAIN_JS" \
    | tr -d '\r' | grep -i '^content-type:' | cut -d: -f2- | xargs
)"

if echo "$CONTENT_TYPE" | grep -qi 'javascript'; then
  print_status "OK: Content-Type is $CONTENT_TYPE"
else
  print_error "Still wrong Content-Type: ${CONTENT_TYPE:-<empty>}"
  print_error "nginx is serving index.html instead of the JS file."
  echo ""
  cat "$SCRIPT_DIR/config/nginx-frontend-locations.conf"
  exit 1
fi

print_status "✅ nginx static serving is fixed"
echo "Site: https://$HOST_HEADER/shyam_akaash"
