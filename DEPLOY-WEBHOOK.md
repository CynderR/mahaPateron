# GitHub auto-deploy webhook

When someone pushes to `main`, GitHub notifies the server and
`update-production.sh` runs automatically.

## What was added

- `deploy-webhook/server.js` — verifies GitHub signatures and starts deploys
- `deploy-webhook/trigger-deploy.sh` — runs `update-production.sh` with a lock
- `config/nginx-deploy-webhook.snippet` — proxies `/hooks/github-deploy` to the listener
- `scripts/setup-deploy-webhook.sh` — one-time server setup

The webhook service runs under PM2 as `deploy-webhook` on `127.0.0.1:9000`.
It is **not** part of the main backend, so deploys can restart the app safely.

## Server setup (run once)

SSH into the production server:

```bash
cd /var/www/user-management-app
git pull origin main
chmod +x scripts/setup-deploy-webhook.sh
./scripts/setup-deploy-webhook.sh
```

The setup script will:

1. Create `/var/log/deploy-webhook`
2. Generate `deploy-webhook/.env` with random `GITHUB_WEBHOOK_SECRET` and `DEPLOY_LOG_TOKEN`
3. Patch nginx automatically (`scripts/patch-nginx-deploy-webhook.py`)
4. Start `deploy-webhook` via PM2

If auto-detection picks the wrong nginx site, set `NGINX_SITE` and re-run:

```bash
NGINX_SITE=/etc/nginx/sites-available/your-site.conf ./scripts/setup-deploy-webhook.sh
```

Manual nginx patch only:

```bash
sudo python3 scripts/patch-nginx-deploy-webhook.py
sudo nginx -t && sudo systemctl reload nginx
```

## Configure GitHub

1. Open the repo on GitHub → **Settings** → **Webhooks** → **Add webhook**
2. **Payload URL:** `https://4thstate.ca/hooks/github-deploy`
3. **Content type:** `application/json`
4. **Secret:** copy `GITHUB_WEBHOOK_SECRET` from `deploy-webhook/.env` on the server
5. **Which events:** “Just the push event”
6. Save — GitHub sends a ping; the server should respond with `pong`

Only pushes to `main` trigger a deploy. Pushes to other branches are ignored.

## Verify it works

```bash
# Webhook service health
curl -s http://127.0.0.1:9000/health

# Last deploy status (public, read-only)
curl -s https://4thstate.ca/hooks/github-deploy/status

# Live logs
tail -f /var/log/deploy-webhook/webhook.log
ls -lt /var/log/deploy-webhook/deploy-*.log | head
pm2 logs deploy-webhook --lines 20
```

Push a small change to `main` and confirm a new `deploy-*.log` file appears.

## Build / deploy logs (when a compile fails)

The site keeps serving the **previous** build if `npm run build` fails, but logs are
available over HTTP from the same `deploy-webhook` service (separate from the main app).

| URL | Purpose |
|-----|---------|
| `/hooks/github-deploy/status` | JSON summary (`state`, `commit`, `buildError`, log paths) |
| `/hooks/github-deploy/failed` | HTML page with the build log (only when last deploy failed) |
| `/hooks/github-deploy/logs/build` | React compile output only (`last-build.log`) |
| `/hooks/github-deploy/logs/latest` | Full deploy log for the last run |
| `/hooks/github-deploy/logs` | JSON list of recent `deploy-*.log` files |

Open in a browser (HTML) or use `curl` (plain text). Add `?tail=200` for the last 200 lines.

```bash
# Quick check after a failed push
curl -s https://4thstate.ca/hooks/github-deploy/status

# Build log in the browser (after a failure, no token needed)
# https://4thstate.ca/hooks/github-deploy/failed

# With token (always works, even after a successful deploy)
TOKEN="$(grep '^DEPLOY_LOG_TOKEN=' deploy-webhook/.env | cut -d= -f2-)"
curl -s "https://4thstate.ca/hooks/github-deploy/logs/build?token=$TOKEN"
curl -s "https://4thstate.ca/hooks/github-deploy/logs/latest?token=$TOKEN&tail=100"
```

Without `DEPLOY_LOG_TOKEN`, log endpoints are only readable while a deploy is **running**
or after it **failed**. When the last deploy failed, `/failed`, `/logs/build`, and
`/logs/latest` all work in a browser with no token. A token is only needed to read logs
after a **successful** deploy.

On the server, raw files live under `/var/log/deploy-webhook/`:

- `deploy-YYYYMMDD_HHMMSS.log` — full deploy output
- `last-build.log` — latest `npm run build` output
- `last-status.json` — last deploy state

## Security notes

- The webhook secret must match on GitHub and in `deploy-webhook/.env`
- The listener binds to localhost only; nginx is the public entry point
- Unsigned or wrongly signed requests are rejected with `401`
- Deploy logs may contain paths and dependency errors — protect them with `DEPLOY_LOG_TOKEN`
- Use branch protection on `main` so only trusted people can deploy
- `deploy-webhook/.env` is gitignored — never commit the secret

## Troubleshooting

| Symptom | Check |
|---------|-------|
| `404` on `/hooks/github-deploy/status` | Run `sudo python3 scripts/patch-nginx-deploy-webhook.py && sudo nginx -t && sudo systemctl reload nginx` |
| `webhook.log` missing | Normal before first event; re-run setup to create it, or wait for a GitHub ping/push |
| `Host key verification failed` in deploy log | Reset `~/.ssh/known_hosts` (hostname only) and add `CheckHostIP no` under `Host github.com` in `~/.ssh/config` |
| `PM2 ... user-management-backend not found` | `pm2 start ecosystem.config.js --only user-management-backend && pm2 save` (latest `update-production.sh` auto-starts if missing) |
| `401 Invalid signature` | Secret mismatch between GitHub and `.env` |
| `Deploy already in progress` | Previous deploy still running; wait or inspect latest log |
| Deploy fails mid-run | `curl -s https://4thstate.ca/hooks/github-deploy/failed` or `tail -100 /var/log/deploy-webhook/deploy-*.log` |
| `403` on `/logs/*` URLs | Last deploy succeeded — pass `?token=...` from `DEPLOY_LOG_TOKEN`, or wait for a failure |
| `404` on `/hooks/github-deploy/failed` | Last deploy succeeded — use `/logs/build?token=...` instead |
| nginx 502 | `pm2 status` — is `deploy-webhook` online? |

Manual deploy still works:

```bash
cd /var/www/user-management-app
./update-production.sh
```

## Environment variables

See `deploy-webhook/.env.example`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `GITHUB_WEBHOOK_SECRET` | (required) | HMAC secret shared with GitHub |
| `DEPLOY_BRANCH` | `main` | Branch that triggers deploy |
| `DEPLOY_WEBHOOK_HOST` | `127.0.0.1` | Bind address |
| `DEPLOY_WEBHOOK_PORT` | `9000` | Listen port |
| `DEPLOY_LOG_DIR` | `/var/log/deploy-webhook` | Deploy logs |
| `DEPLOY_LOG_TOKEN` | (optional) | Protects log endpoints; generated by setup script |
