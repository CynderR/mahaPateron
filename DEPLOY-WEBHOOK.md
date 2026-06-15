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
2. Generate `deploy-webhook/.env` with a random `GITHUB_WEBHOOK_SECRET`
3. Install the nginx snippet
4. Start `deploy-webhook` via PM2

If nginx does not yet include the snippet, add this inside the `server { }` block
for `4thstate.ca` in `/etc/nginx/sites-available/user-management-app`:

```nginx
include snippets/deploy-webhook.conf;
```

Then reload nginx:

```bash
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

## Security notes

- The webhook secret must match on GitHub and in `deploy-webhook/.env`
- The listener binds to localhost only; nginx is the public entry point
- Unsigned or wrongly signed requests are rejected with `401`
- Use branch protection on `main` so only trusted people can deploy
- `deploy-webhook/.env` is gitignored — never commit the secret

## Troubleshooting

| Symptom | Check |
|---------|-------|
| GitHub shows red delivery | `pm2 logs deploy-webhook`, nginx error log |
| `401 Invalid signature` | Secret mismatch between GitHub and `.env` |
| `Deploy already in progress` | Previous deploy still running; wait or inspect latest log |
| Deploy fails mid-run | `tail -100 /var/log/deploy-webhook/deploy-*.log` |
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
