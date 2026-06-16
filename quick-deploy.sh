#!/bin/bash
# deploy.sh
cd /var/www/user-management-app
source ~/.nvm/nvm.sh && nvm use 22.21.0
git pull origin main
npm install
cd backend && npm install && cd ..
npm run build
pm2 restart user-management-backend --update-env
echo "✅ Deployment complete!"
