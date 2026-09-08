# Staging / dev site on the same server

Production stays at `https://4thstate.ca/shyam_akaash/` (folder
`/var/www/user-management-app`, branch `main`, port `5000`).

Staging is a **second clone** at `https://4thstate.ca/shyam_akaash_dev/`
(folder `/var/www/user-management-app-dev`, branch `dev`, port `5001`).

## 1. Clone + branch (if not done)

```bash
sudo mkdir -p /var/www/user-management-app-dev
sudo chown "$USER:$USER" /var/www/user-management-app-dev
git clone <your-repo-url> /var/www/user-management-app-dev
cd /var/www/user-management-app-dev
git checkout dev
```

## 2. Backend env (do not copy production secrets blindly)

```bash
cd /var/www/user-management-app-dev
cp .env.example backend/.env
nano backend/.env
```

Set at least:

```bash
NODE_ENV=production
PORT=5001
APP_BASE_PATH=/shyam_akaash_dev
BASE_URL=https://4thstate.ca/shyam_akaash_dev
CORS_ORIGIN=https://4thstate.ca
JWT_SECRET=<new random secret, or a dedicated staging secret>
DATABASE_URL=./users-dev.db
UPLOAD_DIR=/var/www/user-management-app-dev/backend/uploads
```

Use a **separate** DB and uploads path so staging cannot wipe production.

## 3. Install, build, start PM2

```bash
cd /var/www/user-management-app-dev
npm install
(cd backend && npm install --omit=dev)

PUBLIC_URL=/shyam_akaash_dev REACT_APP_BASE_PATH=/shyam_akaash_dev npm run build

# Start only the staging backend (do not start deploy-webhook from this clone)
PM2_APP_NAME=user-management-backend-dev pm2 start ecosystem.config.js --only user-management-backend-dev
pm2 save
```

If the process name does not match (PM2 resolves the name from env at config load time):

```bash
PM2_APP_NAME=user-management-backend-dev pm2 start ecosystem.config.js --only user-management-backend
# then rename if needed:
pm2 restart user-management-backend-dev --update-env
```

Health check:

```bash
curl -sf http://localhost:5001/api/health && echo OK
pm2 status
```

## 4. nginx snippet

```bash
cd /var/www/user-management-app-dev   # or pull this file from main
sudo cp config/nginx-shyam-akaash-dev.snippet /etc/nginx/snippets/shyam-akaash-dev.conf
```

In each `server { }` block for `4thstate.ca` (HTTP and HTTPS), next to the prod include, add:

```nginx
include snippets/shyam-akaash.conf;
include snippets/shyam-akaash-dev.conf;
```

Then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 5. Open staging

https://4thstate.ca/shyam_akaash_dev/

Production must still be https://4thstate.ca/shyam_akaash/

## Updating staging after you push to `dev`

There is no auto-deploy for `dev` yet. On the server:

```bash
cd /var/www/user-management-app-dev
git pull origin dev
npm install
(cd backend && npm install --omit=dev)
PUBLIC_URL=/shyam_akaash_dev REACT_APP_BASE_PATH=/shyam_akaash_dev npm run build
pm2 restart user-management-backend-dev --update-env
```

Or, if this tree has the same `update-production.sh`:

```bash
GIT_BRANCH=dev ./update-production.sh
# then ensure PM2 restarted the *dev* process, not production
pm2 restart user-management-backend-dev --update-env
```

(`update-production.sh` currently restarts `user-management-backend` by name — prefer the explicit `pm2 restart user-management-backend-dev` on staging.)

## Create an admin on staging (optional)

```bash
cd /var/www/user-management-app-dev/backend
# set ADMIN_PASSWORD in backend/.env first
node create-admin.js
```
