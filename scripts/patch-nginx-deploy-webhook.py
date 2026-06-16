#!/usr/bin/env python3
"""
Add the deploy-webhook nginx snippet include to every server { } block.

Usage (on the Debian server):
  sudo python3 scripts/patch-nginx-deploy-webhook.py
  sudo nginx -t && sudo systemctl reload nginx
"""

from __future__ import annotations

import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent.parent
SNIPPET_SRC = SCRIPT_DIR / "config" / "nginx-deploy-webhook.snippet"
NGINX_SNIPPET = Path("/etc/nginx/snippets/deploy-webhook.conf")
INCLUDE_LINE = "    include snippets/deploy-webhook.conf;\n"

SITE_CANDIDATES = [
    Path("/etc/nginx/sites-available/user-management-app"),
    Path("/etc/nginx/sites-available/4thstate.ca"),
    Path("/etc/nginx/sites-available/default"),
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


def remove_deploy_webhook_locations(text: str) -> str:
    pattern = re.compile(r"^\s*location\s+=\s+/hooks/github-deploy", re.MULTILINE)
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
        r"^\s*include\s+snippets/deploy-webhook\.conf;\s*\n",
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
        block = remove_deploy_webhook_locations(block)
        block = remove_include_lines(block)
        if INCLUDE_LINE.strip() not in block:
            block = block[:-1] + "\n" + INCLUDE_LINE + "}\n"
        result.append(block)
        i = end
    return "".join(result)


def discover_nginx_site() -> Path | None:
    env_site = Path(
        __import__("os").environ.get("NGINX_SITE", "/etc/nginx/sites-available/user-management-app")
    )
    if env_site.is_file():
        return env_site

    sites_enabled = Path("/etc/nginx/sites-enabled")
    if sites_enabled.is_dir():
        for path in sorted(sites_enabled.iterdir()):
            if not path.is_file():
                continue
            try:
                body = path.read_text()
            except OSError:
                continue
            if "4thstate.ca" in body or "shyam_akaash" in body:
                return path.resolve()

    for candidate in SITE_CANDIDATES:
        if candidate.is_file():
            return candidate

    return None


def patch_site(nginx_site: Path, snippet_body: str) -> None:
    site_body = nginx_site.read_text()
    backup = nginx_site.with_suffix(
        nginx_site.suffix + f".deploy-webhook.bak.{datetime.now().strftime('%Y%m%d%H%M%S')}"
    )
    shutil.copy2(nginx_site, backup)
    print(f"Backed up {nginx_site} to {backup}")

    NGINX_SNIPPET.parent.mkdir(parents=True, exist_ok=True)
    NGINX_SNIPPET.write_text(snippet_body)
    print(f"Wrote {NGINX_SNIPPET}")

    patched = insert_include_in_server_blocks(
        remove_include_lines(remove_deploy_webhook_locations(site_body))
    )
    nginx_site.write_text(patched)
    print(f"Patched {nginx_site}")


def main() -> int:
    if not SNIPPET_SRC.is_file():
        print(f"Missing snippet: {SNIPPET_SRC}", file=sys.stderr)
        return 1

    nginx_site = discover_nginx_site()
    if nginx_site is None:
        print("Could not find nginx site config for 4thstate.ca", file=sys.stderr)
        print("Set NGINX_SITE=/path/to/site and re-run.", file=sys.stderr)
        return 1

    print(f"Using nginx site: {nginx_site}")
    patch_site(nginx_site, SNIPPET_SRC.read_text())

    body = nginx_site.read_text()
    if "include snippets/deploy-webhook.conf" not in body:
        print("Warning: include line missing after patch", file=sys.stderr)
        return 1

    print("Run: sudo nginx -t && sudo systemctl reload nginx")
    return 0


if __name__ == "__main__":
    sys.exit(main())
