#!/usr/bin/env python3
"""
Replace shyam_akaash nginx location blocks in every server { } block.

Usage (on the Debian server):
  sudo python3 scripts/patch-nginx-frontend.py
  sudo nginx -t && sudo systemctl reload nginx
  ./fix-nginx.sh
"""

from __future__ import annotations

import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent.parent
SNIPPET_SRC = SCRIPT_DIR / "config" / "nginx-shyam-akaash.snippet"
NGINX_SITE = Path("/etc/nginx/sites-available/user-management-app")
NGINX_SNIPPET = Path("/etc/nginx/snippets/shyam-akaash.conf")
INCLUDE_LINE = "    include snippets/shyam-akaash.conf;\n"

# location lines managed by snippets/shyam-akaash.conf (removed before re-adding include)
SHYAM_LOCATION_RES = [
    re.compile(r"^\s*location\s+(?:\^~\s+)?(?:=\s+)?/shyam_akaash", re.MULTILINE),
    re.compile(
        r"^\s*location\s+~\s+\^?/shyam_akaash/\(rss\|stream\|uploads\)",
        re.MULTILINE,
    ),
]


def find_block_end(text: str, open_brace: int) -> int:
    depth = 0
    i = open_brace
    while i < len(text):
        ch = text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    raise ValueError("Unbalanced braces in nginx config")


def remove_shyam_locations(text: str) -> str:
    for pattern in SHYAM_LOCATION_RES:
        while True:
            match = pattern.search(text)
            if not match:
                break
            brace = text.find("{", match.start())
            if brace == -1:
                break
            end = find_block_end(text, brace)
            text = text[: match.start()] + text[end:]
    return text


def remove_include_lines(text: str) -> str:
    return re.sub(
        r"^\s*include\s+snippets/shyam-akaash\.conf;\s*\n",
        "",
        text,
        flags=re.MULTILINE,
    )


def insert_include_in_server_blocks(text: str) -> str:
    result: list[str] = []
    i = 0
    while i < len(text):
        server_match = re.search(r"\bserver\s*\{", text[i:])
        if not server_match:
            result.append(text[i:])
            break
        start = i + server_match.start()
        result.append(text[i:start])
        brace = text.find("{", start)
        end = find_block_end(text, brace)
        block = text[start:end]
        block = remove_shyam_locations(block)
        block = remove_include_lines(block)
        if INCLUDE_LINE.strip() not in block:
            anchor = re.search(
                r"^\s*location\s+/api\s*\{",
                block,
                re.MULTILINE,
            )
            if anchor:
                block = block[: anchor.start()] + INCLUDE_LINE + block[anchor.start() :]
            else:
                block = block[:-1] + "\n" + INCLUDE_LINE + "}\n"
        result.append(block)
        i = end
    return "".join(result)


def main() -> int:
    if not SNIPPET_SRC.is_file():
        print(f"Missing snippet: {SNIPPET_SRC}", file=sys.stderr)
        return 1
    if not NGINX_SITE.is_file():
        print(f"Missing nginx site: {NGINX_SITE}", file=sys.stderr)
        return 1

    snippet_body = SNIPPET_SRC.read_text()
    site_body = NGINX_SITE.read_text()

    backup = NGINX_SITE.with_suffix(
        NGINX_SITE.suffix + f".bak.{datetime.now().strftime('%Y%m%d%H%M%S')}"
    )
    shutil.copy2(NGINX_SITE, backup)
    print(f"Backed up site config to {backup}")

    NGINX_SNIPPET.parent.mkdir(parents=True, exist_ok=True)
    NGINX_SNIPPET.write_text(snippet_body)
    print(f"Wrote {NGINX_SNIPPET}")

    patched = remove_include_lines(remove_shyam_locations(site_body))
    patched = insert_include_in_server_blocks(patched)
    NGINX_SITE.write_text(patched)
    print(f"Patched {NGINX_SITE} (include added in each server block)")

    if "include snippets/shyam-akaash.conf" not in patched:
        print("Warning: include line may be missing — check the config manually", file=sys.stderr)
        return 1

    print("Run: sudo nginx -t && sudo systemctl reload nginx && ./fix-nginx.sh")
    return 0


if __name__ == "__main__":
    sys.exit(main())
