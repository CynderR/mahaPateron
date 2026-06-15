module.exports = {
  apps: [
    {
      name: 'user-management-backend',
      script: './backend/server.js',
      cwd: '/var/www/user-management-app',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: '/var/log/pm2/user-management-backend-error.log',
      out_file: '/var/log/pm2/user-management-backend-out.log',
      log_file: '/var/log/pm2/user-management-backend.log',
      time: true,
    },
    {
      name: 'deploy-webhook',
      script: './deploy-webhook/server.js',
      cwd: '/var/www/user-management-app',
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
