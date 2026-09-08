const path = require('path');

// PORT / APP_BASE_PATH / BASE_URL come from backend/.env (loaded by server.js).
// For a staging clone, use a different PM2 name and cwd, e.g.:
//   PM2_APP_NAME=user-management-backend-dev pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || 'user-management-backend',
      script: './backend/server.js',
      cwd: process.env.PM2_APP_CWD || path.resolve(__dirname),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/user-management-backend-error.log',
      out_file: '/var/log/pm2/user-management-backend-out.log',
      log_file: '/var/log/pm2/user-management-backend.log',
      time: true,
    },
    {
      name: 'deploy-webhook',
      script: './deploy-webhook/server.js',
      cwd: path.resolve(__dirname),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/deploy-webhook-error.log',
      out_file: '/var/log/pm2/deploy-webhook-out.log',
      log_file: '/var/log/pm2/deploy-webhook.log',
      time: true,
    },
  ],
};
