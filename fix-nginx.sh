#!/bin/bash

# Ensure nginx serves the CRA build with correct MIME types.
# Run on the server after git pull:
#   ./fix-nginx.sh
#
# Applies scripts/patch-nginx-frontend.py automatically when the site config
# is missing the shyam-akaash snippet include.

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
APPLY_NGINX_PATCH="${APPLY_NGINX_PATCH:-1}"

if ! ls build/static/js/main.*.js >/dev/null 2>&1; then
  print_error "No build/static/js/main.*.js — run npm run build first"
  exit 1
fi

if [ ! -f build/index.html ]; then
  print_error "build/index.html is missing — run npm run build first"
  exit 1
fi

MAIN_JS="$(basename "$(ls build/static/js/main.*.js | head -1)")"
DISK_PATH="$SCRIPT_DIR/build/static/js/$MAIN_JS"
print_status "JS bundle on disk: build/static/js/$MAIN_JS"

if [ ! -f "$DISK_PATH" ]; then
  print_error "Build output incomplete — $DISK_PATH not found"
  exit 1
fi

# Optional legacy symlink (nginx now aliases build/ directly).
ln -sfn "$SCRIPT_DIR/build" "$SCRIPT_DIR/shyam_akaash"

apply_nginx_patch() {
  print_status "Applying nginx patch (scripts/patch-nginx-frontend.py)..."
  sudo python3 "$SCRIPT_DIR/scripts/patch-nginx-frontend.py"
}

needs_patch=0
if [ -f "$NGINX_SITE" ]; then
  # Legacy inline SPA block used alias .../build; (not .../build/static/)
  if grep -q 'alias /var/www/user-management-app/build;' "$NGINX_SITE" 2>/dev/null; then
    print_warning "Legacy inline SPA alias still in $NGINX_SITE"
    needs_patch=1
  fi
  if ! grep -q 'include snippets/shyam-akaash.conf' "$NGINX_SITE" 2>/dev/null \
     && ! grep -q 'location \^~ /shyam_akaash/static/' "$NGINX_SITE" 2>/dev/null; then
    print_warning "No static location or shyam-akaash snippet include in $NGINX_SITE"
    needs_patch=1
  fi
fi

if [ "$APPLY_NGINX_PATCH" = "1" ] && [ "$needs_patch" = "1" ]; then
  apply_nginx_patch
elif [ "$needs_patch" = "1" ]; then
  print_error "nginx frontend config is not patched yet."
  echo ""
  echo "Run on the server:"
  echo "  APPLY_NGINX_PATCH=1 ./fix-nginx.sh"
  echo ""
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

print_status "Checking index.html..."
INDEX_STATUS="$(fetch_status "https://127.0.0.1/shyam_akaash/index.html")"
print_status "HTTPS index.html status: ${INDEX_STATUS:-<empty>}"
if [ "$INDEX_STATUS" != "200" ]; then
  print_error "index.html is not being served (HTTP $INDEX_STATUS)"
  print_error "Check: ls -la build/index.html && sudo nginx -T | grep -A8 'shyam_akaash/'"
  exit 1
fi

print_status "Checking JS MIME type (HTTPS)..."
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
  print_warning "JS Content-Type is ${CONTENT_TYPE:-<empty>} — applying nginx patch and retrying..."
  apply_nginx_patch
  sudo nginx -t
  sudo systemctl reload nginx
  HTTPS_CT="$(fetch_content_type "https://127.0.0.1$JS_URL")"
  if echo "$HTTPS_CT" | grep -qi 'javascript'; then
    print_status "OK after patch: JS served as $HTTPS_CT"
  else
    print_error "Still wrong Content-Type: ${HTTPS_CT:-<empty>}"
    print_error "nginx may be serving index.html instead of the JS bundle."
    exit 1
  fi
fi

print_status "✅ nginx static serving is fixed"
echo "Site: https://$HOST_HEADER/shyam_akaash"
