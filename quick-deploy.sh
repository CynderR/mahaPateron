#!/bin/bash
# deploy.sh
cd /var/www/user-management-app
source ~/.nvm/nvm.sh && nvm use 22.21.0
git pull origin main
npm install
cd backend && npm install && cd ..
npm run build
if pm2 describe user-management-backend >/dev/null 2>&1; then
  pm2 restart user-management-backend --update-env
else
  pm2 start ecosystem.config.js --only user-management-backend
  pm2 save
fi
echo "✅ Deployment complete!"
