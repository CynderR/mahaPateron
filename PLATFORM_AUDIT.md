# Platform Audit

This document captures the state of the existing application before the podcast membership platform was layered on top of it. It is the reference for why the new code extends, rather than replaces, the existing systems.

## Application Layout

The entire application lives under `user-management-app/`:

- `backend/` — a single Express server (`server.js`) with SQLite, JWT auth, and (formerly) Patreon integration.
- `src/` — a Create React App (CRA) frontend written entirely in TypeScript.

There is no separate `server/` directory at the repository root; the spec's `/server/...` paths map to `backend/...`.

## Authentication

- Strategy: JSON Web Tokens (`jsonwebtoken`) sent as `Authorization: Bearer <token>`. There is no server-side session store. Cookies (`cookie-parser`) were used only by the now-removed Patreon OAuth signup flow.
- Tokens expire after 24 hours and carry `{ id, username, email, is_admin }`.
- Passwords are hashed with `bcryptjs` (10 rounds). The reset flow uses a crypto random token plus `nodemailer` (`backend/emailService.js`).
- Middleware (originally inline in `server.js`, now extracted to `backend/middleware/`):
  - `authenticateToken` — verifies the JWT and sets `req.user`.
  - `requireAdmin` — requires `req.user.is_admin`.

Decision: the new platform reuses `authenticateToken` and `requireAdmin` exactly. No second auth system is introduced. Admin access continues to use the existing `is_admin` boolean rather than a new `role` enum, because the JWT payload and every existing check already depend on it.

## Database

- Engine: SQLite via the `sqlite3` package. The database file path comes from `DATABASE_URL` or defaults to `backend/users.db`.
- There is no ORM and no migration tool. Schema is created in `backend/database.js` `initDatabase()` using `CREATE TABLE IF NOT EXISTS` followed by nested `ALTER TABLE` calls that ignore "duplicate column name" errors. This is the project's de-facto migration mechanism.
- Primary keys on `users` are `INTEGER PRIMARY KEY AUTOINCREMENT`.

Decision: new schema is added by extending `initDatabase()` in the same nested-`ALTER TABLE` style, invoked through `backend/migrations/20260531120000_podcast_platform.js`. The existing integer `users.id` is kept (changing it would break every existing row and JWT). UUIDs are used only where the spec requires a public, non-enumerable identifier: `users.rss_token` and `posts.id`.

### Existing `users` columns

`id, username, email, password, is_free, is_admin, password_reset_token, password_reset_expires, created_at, updated_at`

### Columns added by this platform

`whatsapp_id, signal_id, payment_category, is_paying, access_type, stripe_customer_id, stripe_sub_id, rss_token (UNIQUE), subscription_price, deleted_at`

### New tables

- `posts` — podcast episodes (UUID id, audio/image filenames, duration, publish flag, soft-delete).
- `platform_settings` — single-row configuration (default price, Stripe price id, webhook secret).
- `stream_events` — optional per-stream analytics rows.

## Frontend

- React 19 with `react-scripts` 5 (CRA). Not Vite, not a custom webpack config.
- 100% TypeScript (`.tsx` / `.ts`). New files therefore use `.tsx`, not `.jsx`.
- Routing: `react-router-dom` v7 (`BrowserRouter`, `Routes`, `Route`, `Navigate`).
- State: React Context only — `AuthContext` (auth/user) and `ThemeContext` (light/dark). No Redux or React Query.
- HTTP: `axios` with `axios.defaults.baseURL` set to `/api` in production and `http://localhost:5000/api` in development. The JWT is stored in `localStorage` and set as a default `Authorization` header.
- Components live flat in `src/components/` with co-located `.css` files. New podcast pages are added under `src/pages/` and new shared components under `src/components/`.

## Styling

- There is no SCSS in the project. Styling is plain CSS using CSS custom properties defined in `src/styles/themes.css` (colors, shadows) with `[data-theme="dark"]` overrides.
- `src/components/Dashboard.css` is the closest thing to a component design system (cards, tables, buttons, banners) and uses the theme tokens.

Decision: the spec asks for `_podcast.scss` extending SCSS variables, but no SCSS pipeline or SCSS variables exist. Introducing Sass would add a second styling paradigm, which the spec explicitly forbids. Instead, a plain `src/styles/podcast.css` reuses the existing `--bg-*`, `--text-*`, `--accent-*`, `--border-*`, and `--shadow-*` custom properties and mirrors the `Dashboard.css` patterns. It is imported in `App.tsx` alongside `themes.css`.

## Email

`backend/emailService.js` sends password-reset emails through `nodemailer` (SMTP via `SMTP_USER` / `SMTP_PASS`). The new platform reuses this sender and does not add a second one.

## Patreon (removed)

The original app integrated Patreon: OAuth sign-in/link/signup, an RSS proxy, patron sync, and subscription alerts, spread across `server.js`, `backend/patreonService.js`, and several frontend components. Per the agreed direction, Patreon is fully removed and replaced by self-hosted Stripe billing plus self-hosted RSS and streaming. Removed: the Patreon backend routes, `patreonService.js`, all Patreon frontend components, the Patreon OAuth sign-in/sign-up buttons, and the Patreon-specific columns (`patreon_id`, `patreon_subscription_status`, `last_patreon_sync`, `subscription_alert_sent`) from the `users` schema and all CRUD helpers. Existing databases that already have these columns are unaffected (they simply go unused); fresh databases are created without them.

## Mixcloud / HearThis (removed)

The original app also supported Mixcloud sign-up (`/signup/mixcloud`, `is_mixcloud` flag) and HearThis onboarding (`HearThisSetupModal`, `Join_Shyam_Akaash_on_HearThis.pdf`). These are fully removed: the `is_mixcloud` column and `mixcloud_id` migration logic are gone from `database.js`, the HearThis and Patreon guide PDFs are deleted from `public/`, and the related frontend components were removed in the prior cleanup.

## Deployment

- nginx + pm2, configured by `deploy.sh`. nginx serves the CRA build and proxies `/api` to the Node server on port 5000.
- Production lives under the `/shyam_akaash` subpath at `https://4thstate.ca/shyam_akaash`. The React app is therefore served with `basename="/shyam_akaash"`, and RSS/stream URLs are built from `BASE_URL=https://4thstate.ca/shyam_akaash`. nginx must pass `Range`/`If-Range` headers and disable buffering for the streaming route.

## Deviations from the original spec

| Spec | Implementation | Reason |
|------|----------------|--------|
| `_podcast.scss` extending SCSS variables | `src/styles/podcast.css` using CSS custom properties | No SCSS pipeline or SCSS variables exist; adding Sass would create a second styling system |
| `role ENUM('admin','user')` | Existing `is_admin` boolean | JWT payload and all checks already use `is_admin` |
| `users.id` as UUID | Existing `INTEGER` id; UUIDs only for `rss_token` and `posts.id` | Changing the PK breaks existing rows and tokens |
| `.jsx` files | `.tsx` files | The frontend is entirely TypeScript |
| `/server/routes/...` | `backend/routes/...` | Matches the real directory layout |
| Keep Patreon | Patreon removed | Agreed direction: self-hosted replaces Patreon |
| Domain-root RSS/stream URLs | `/shyam_akaash/rss/:token`, `/shyam_akaash/stream/:postId` | Subpath deployment at 4thstate.ca |
