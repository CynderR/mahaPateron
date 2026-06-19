#!/bin/bash

# Ensure the shyam_akaash symlink exists and nginx serves JS/CSS with the correct
# MIME type. Run on the server after git pull:
#   ./fix-nginx.sh
#
# If nginx config is still wrong, apply the automated patch first:
#   sudo python3 scripts/patch-nginx-frontend.py
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
APPLY_NGINX_PATCH="${APPLY_NGINX_PATCH:-0}"

print_status "Linking build/ → shyam_akaash/ (required for root+try_files)..."
ln -sfn "$SCRIPT_DIR/build" "$SCRIPT_DIR/shyam_akaash"

if ! ls build/static/js/main.*.js >/dev/null 2>&1; then
  print_error "No build/static/js/main.*.js — run npm run build first"
  exit 1
fi

MAIN_JS="$(basename "$(ls build/static/js/main.*.js | head -1)")"
DISK_PATH="$SCRIPT_DIR/shyam_akaash/static/js/$MAIN_JS"
print_status "JS bundle on disk: shyam_akaash/static/js/$MAIN_JS"

if [ ! -f "$DISK_PATH" ]; then
  print_error "Symlink broken — $DISK_PATH not found"
  exit 1
fi

if [ "$APPLY_NGINX_PATCH" = "1" ]; then
  print_status "Applying nginx patch (scripts/patch-nginx-frontend.py)..."
  sudo python3 "$SCRIPT_DIR/scripts/patch-nginx-frontend.py"
fi

needs_patch=0
if [ -f "$NGINX_SITE" ]; then
  if grep -q 'alias /var/www/user-management-app/build' "$NGINX_SITE" 2>/dev/null; then
    print_warning "Old alias /var/www/user-management-app/build still in $NGINX_SITE"
    needs_patch=1
  fi
  if ! grep -q 'include snippets/shyam-akaash.conf' "$NGINX_SITE" 2>/dev/null \
     && ! grep -q 'location \^~ /shyam_akaash/static/' "$NGINX_SITE" 2>/dev/null; then
    print_warning "No static location or shyam-akaash snippet include in $NGINX_SITE"
    needs_patch=1
  fi
fi

if [ "$needs_patch" = "1" ]; then
  print_error "nginx frontend config is not patched yet."
  echo ""
  echo "Run on the server:"
  echo "  sudo python3 scripts/patch-nginx-frontend.py"
  echo "  ./fix-nginx.sh"
  echo ""
  echo "Or edit manually: sudo nano $NGINX_SITE"
  cat "$SCRIPT_DIR/config/nginx-frontend-locations.conf"
  exit 1
fi

print_status "Testing nginx config..."
sudo nginx -t
sudo systemctl reload nginx

fetch_content_type() {
  local url="$1"
  curl -skI -H "Host: $HOST_HEADER" "$url" 2>/dev/null \
    | tr -d '\r' | grep -i '^content-type:' | head -1 | cut -d: -f2- | xargs
}

fetch_status() {
  local url="$1"
  curl -skI -H "Host: $HOST_HEADER" "$url" 2>/dev/null \
    | tr -d '\r' | grep -i '^HTTP/' | head -1 | awk '{print $2}'
}

print_status "Active nginx shyam_akaash locations:"
sudo nginx -T 2>/dev/null | grep -A6 'shyam_akaash/static' | head -20 || true

print_status "Checking MIME type (HTTPS — same path browsers use)..."
JS_URL="/shyam_akaash/static/js/$MAIN_JS"
HTTPS_CT="$(fetch_content_type "https://127.0.0.1$JS_URL")"
HTTPS_STATUS="$(fetch_status "https://127.0.0.1$JS_URL")"
print_status "HTTPS $HTTPS_STATUS Content-Type: ${HTTPS_CT:-<empty>}"

CONTENT_TYPE="$HTTPS_CT"
if ! echo "$CONTENT_TYPE" | grep -qi 'javascript'; then
  HTTP_CT="$(fetch_content_type "http://127.0.0.1$JS_URL")"
  HTTP_STATUS="$(fetch_status "http://127.0.0.1$JS_URL")"
  print_warning "HTTP $HTTP_STATUS Content-Type: ${HTTP_CT:-<empty>} (port 80 may only redirect to HTTPS)"
  CONTENT_TYPE="$HTTP_CT"
fi

if echo "$CONTENT_TYPE" | grep -qi 'javascript'; then
  print_status "OK: JS served as $CONTENT_TYPE"
else
  print_error "Still wrong Content-Type: ${CONTENT_TYPE:-<empty>}"
  print_error "nginx is serving index.html instead of the JS file."
  echo ""
  print_status "Disk file type: $(file -b "$DISK_PATH")"
  echo ""
  echo "Fix:"
  echo "  sudo python3 scripts/patch-nginx-frontend.py"
  echo "  sudo nginx -t && sudo systemctl reload nginx"
  echo "  ./fix-nginx.sh"
  exit 1
fi

print_status "✅ nginx static serving is fixed"
echo "Site: https://$HOST_HEADER/shyam_akaash"
