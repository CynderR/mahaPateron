const path = require('path');

// PORT / APP_BASE_PATH / BASE_URL come from backend/.env (loaded by server.js).
// Staging clone example:
//   PM2_APP_NAME=user-management-backend-dev pm2 start ecosystem.config.js --only user-management-backend-dev
const appName = process.env.PM2_APP_NAME || 'user-management-backend';

module.exports = {
  apps: [
    {
      name: appName,
      script: './backend/server.js',
      cwd: process.env.PM2_APP_CWD || path.resolve(__dirname),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: `/var/log/pm2/${appName}-error.log`,
      out_file: `/var/log/pm2/${appName}-out.log`,
      log_file: `/var/log/pm2/${appName}.log`,
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
