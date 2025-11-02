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
        PORT: 5000
      },
      error_file: '/var/log/pm2/user-management-backend-error.log',
      out_file: '/var/log/pm2/user-management-backend-out.log',
      log_file: '/var/log/pm2/user-management-backend.log',
      time: true,
      // Auto-restart on crash
      autorestart: true,
      // Watch for file changes (disable in production)
      watch: false,
      // Max memory usage before restart
      max_memory_restart: '1G',
      // Restart delay
      restart_delay: 4000,
      // Max restarts per day
      max_restarts: 10,
      // Min uptime before considering restart
      min_uptime: '10s'
    }
  ]
};


