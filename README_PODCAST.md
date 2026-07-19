# Podcast Membership Platform

This documents the self-hosted podcast membership platform layered onto the
existing user-management app. It adds Stripe billing, per-user RSS feeds, and
range-request audio streaming. It runs under the `/shyam_akaash` subpath at
`https://4thstate.ca/shyam_akaash`.

See `PLATFORM_AUDIT.md` for how this code reuses the existing auth, database,
and styling rather than introducing parallel systems.

## What was added

- Database: new `users` columns, plus `posts`, `platform_settings`, and
  `stream_events` tables (migration in
  `backend/migrations/20260531120000_podcast_platform.js`, applied automatically
  on startup).
- Backend routes: `backend/routes/{admin-users,admin-posts,admin,account,rss,stream,payments}.js`
  and middleware in `backend/middleware/`.
- Frontend pages: `src/pages/Feed.tsx`, `src/pages/account/*`, `src/pages/admin/*`
  and components in `src/components/` (`AudioPlayer`, `PostCard`, `RssCopyWidget`,
  `UserTable`, `UploadForm`, `PodcastNav`).
- Styling: `src/styles/podcast.css` built on the existing theme tokens.

Patreon integration was removed and replaced by Stripe + self-hosted media.

## Environment variables

Set these in `backend/.env` (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Existing JWT signing secret |
| `DATABASE_URL` | SQLite file path |
| `CORS_ORIGIN` | Allowed frontend origin(s) |
| `BASE_URL` | Public base URL, e.g. `https://4thstate.ca/shyam_akaash` |
| `UPLOAD_DIR` | Absolute path for uploaded audio/images |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (exposed to the browser) |
| `STRIPE_PRICE_ID` | Official Dashboard Price ID used for all checkouts (or set `platform_settings.stripe_price_id`) |
| `DEFAULT_SUBSCRIPTION_PRICE` | Fallback display/MRR amount if the Stripe Price cannot be loaded |
| `PODCAST_TITLE`, `PODCAST_AUTHOR`, `PODCAST_EMAIL` | Optional RSS channel metadata |
| `PODCAST_COVER_FILE` | Filename in `public/` used as RSS channel artwork (default: `podcast-cover.jpg`, **min 1400×1400 px**) |
| `PODCAST_IMAGE_URL` | Override full URL for RSS channel artwork |

## Build and run

```bash
# Install dependencies
npm run setup            # installs backend + frontend deps

# Backend (port 5000)
cd backend && npm start

# Frontend production build (emits assets under /shyam_akaash/)
cd .. && npm run build
```

The `homepage` field in `package.json` is set to `/shyam_akaash`, so the build
references its JS/CSS bundles under that subpath. Note that any static assets in
`public/` referenced with a root-absolute path (for example the landing
background image `/signal-...jpeg`) resolve at the domain root; serve them there
or reference them via `process.env.PUBLIC_URL` if they must live under the
subpath.

Create the first admin:

```bash
cd backend && node create-admin.js          # admin / p1assword2 — change immediately
cd backend && node create-test-subscriber.js # comped member / testpassword1
```

## nginx configuration

The Express server mounts its routes under both the root and the
`/shyam_akaash` prefix, so nginx forwards the full prefixed path. Streaming
disables buffering and passes `Range` headers so seeking works in podcast apps
and browsers.

```nginx
server {
    listen 80;
    server_name 4thstate.ca www.4thstate.ca;
    client_max_body_size 550M;            # allow 500 MB audio uploads

    # Hashed JS/CSS — must not fall through to index.html (MIME text/html bug).
    location ^~ /shyam_akaash/static/ {
        alias /var/www/user-management-app/build/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /shyam_akaash {
        return 301 /shyam_akaash/;
    }

    location /shyam_akaash/ {
        root /var/www/user-management-app;
        try_files $uri $uri/ /shyam_akaash/index.html;
    }

    # RSS, streaming, and cover images (range requests, no buffering)
    location ~ ^/shyam_akaash/(rss|stream|uploads) {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # JSON API
    location /shyam_akaash/api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

After each `npm run build`, run `./fix-nginx.sh` (or `./update-production.sh`, which calls it).
It refreshes the `shyam_akaash` → `build` symlink and verifies JS is served as
`application/javascript`, not `text/html`.

`deploy.sh` writes this configuration automatically. Add HTTPS with
`sudo certbot --nginx -d 4thstate.ca`.

## Share link previews (WhatsApp, iMessage)

Shared episode URLs (`/shyam_akaash/share/...`) include Open Graph tags so messengers
show the **episode title**, **cover art**, and **Shyam Akaash** as the site name.
nginx always proxies the share landing URL to `backend/routes/shareOg.js`, which
injects `og:*` tags into the SPA `index.html` (so browsers still get the app, and
crawlers do not depend on User-Agent matching). After updating the snippet:

```bash
sudo cp config/nginx-shyam-akaash.snippet /etc/nginx/snippets/shyam-akaash.conf
sudo nginx -t && sudo systemctl reload nginx
```

WhatsApp caches previews aggressively; after a fix, re-share the link in a new
chat (or append `?v=2`) to force a refresh.

## Stripe Price setup

Checkout uses one official recurring Price from the Stripe Product catalog for
every paying subscriber (no per-user Stripe amounts).

1. In Stripe Dashboard → Product catalog, create a Product (e.g. Shyam Akaash
   Membership) with a recurring monthly Price.
2. Copy the Price ID (`price_…`).
3. Set `STRIPE_PRICE_ID=price_…` in `.env`, **or** store it as
   `platform_settings.stripe_price_id` via `PUT /api/admin/settings`.

Until a Price ID is configured, Subscribe returns 503 and Billing shows that
billing is not ready.

## Stripe webhook setup

1. In the Stripe Dashboard, create a webhook endpoint pointing at
   `https://4thstate.ca/shyam_akaash/api/payments/webhook`.
2. Subscribe to `invoice.payment_succeeded`, `invoice.payment_failed`, and
   `customer.subscription.deleted`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` (or set it from the admin
   settings, which stores it in `platform_settings`).
4. The webhook route is registered with `express.raw()` before `express.json()`
   so the signature can be verified against the unparsed body.

Local testing with the Stripe CLI:

```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
stripe trigger invoice.payment_succeeded
```

## How access control works

- `is_paying` gates both RSS items and streaming. An inactive subscriber still
  gets a valid (empty) RSS feed at a stable URL so podcast apps keep polling.
- `access_type` (`rss`, `streaming`, `both`) further restricts which channels a
  user may use.
- The streaming route authenticates with the user's `rss_token` query parameter
  (podcast apps) or a JWT (browser), and validates on every request.
- Admin routes require `is_admin`.

## API surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/rss/:token` | Personal RSS feed |
| GET | `/stream/:postId?token=` | Range-request audio stream |
| GET/POST/PUT/DELETE | `/api/admin/users` | User management (admin) |
| GET/POST/PUT/DELETE | `/api/admin/posts` | Episode management (admin) |
| GET/PUT | `/api/admin/settings`, GET `/api/admin/stats` | Platform config + dashboard |
| GET | `/api/account/feed`, `/api/account/rss` | Member feed and RSS URL |
| PUT | `/api/account/settings`, DELETE `/api/account` | Profile + account deletion |
| POST | `/api/payments/create-subscription`, `/cancel`, `/create-portal-session` | Stripe |
| POST | `/api/payments/webhook` | Stripe webhook (raw body) |

All API routes are also available under the `/shyam_akaash/api` prefix.
