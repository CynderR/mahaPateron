# Deploying User Management App to Debian Server

This guide will help you deploy your user management application to a Debian server.

## Prerequisites

- A Debian server (Ubuntu 20.04+ or Debian 11+)
- Root or sudo access
- Domain name (optional but recommended)
- SSL certificate (Let's Encrypt recommended)

## Step 1: Server Setup

### Update the system
```bash
sudo apt update && sudo apt upgrade -y
```

### Install Node.js (using NodeSource repository)
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

### Install Nginx (Web Server)
```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

### Install SQLite3 (if not already installed)
```bash
sudo apt install sqlite3 -y
```

## Step 2: Application Deployment

### Create application directory
```bash
sudo mkdir -p /var/www/user-management-app
sudo chown $USER:$USER /var/www/user-management-app
```

### Upload your application
```bash
# Option 1: Using SCP (from your local machine)
scp -r /home/j/maha/user-management-app/* user@your-server:/var/www/user-management-app/

# Option 2: Using Git (if you have a repository)
cd /var/www/user-management-app
git clone https://github.com/your-username/user-management-app.git .
```

### Install dependencies
```bash
cd /var/www/user-management-app

# Install backend dependencies
cd backend
npm install --production

# Install frontend dependencies and build
cd ..
npm install
npm run build
```

## Step 3: Environment Configuration

### Create production environment file
```bash
sudo nano /var/www/user-management-app/backend/.env
```

Add your production environment variables:
```env
# Production Environment Variables
NODE_ENV=production
PORT=5000

# JWT Secret (generate a new one for production)
JWT_SECRET=your-super-secure-jwt-secret-here

# Database
DATABASE_URL=/var/www/user-management-app/backend/users.db

# CORS Origin (your domain)
CORS_ORIGIN=https://yourdomain.com

# Patreon API
PATREON_ACCESS_TOKEN=your-patreon-token-here

# Security
BCRYPT_ROUNDS=12
```

### Set proper permissions
```bash
sudo chown -R www-data:www-data /var/www/user-management-app
sudo chmod -R 755 /var/www/user-management-app
sudo chmod 600 /var/www/user-management-app/backend/.env
```

## Step 4: PM2 Configuration

### Create PM2 ecosystem file
```bash
nano /var/www/user-management-app/ecosystem.config.js
```

Add the following configuration:
```javascript
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
      time: true
    }
  ]
};
```

### Start the application with PM2
```bash
cd /var/www/user-management-app
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Step 5: Nginx Configuration

### Create Nginx configuration
```bash
sudo nano /etc/nginx/sites-available/user-management-app
```

Add the following configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend (React app)
    location / {
        root /var/www/user-management-app/build;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

### Enable the site
```bash
sudo ln -s /etc/nginx/sites-available/user-management-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 6: SSL Certificate (Let's Encrypt)

### Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Obtain SSL certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Test automatic renewal
```bash
sudo certbot renew --dry-run
```

## Step 7: Firewall Configuration

### Configure UFW
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Step 8: Database Setup

### Create admin user
```bash
cd /var/www/user-management-app/backend
node create-admin.js
```

## Step 9: Monitoring and Logs

### View PM2 logs
```bash
pm2 logs user-management-backend
```

### View Nginx logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Monitor PM2 processes
```bash
pm2 status
pm2 monit
```

## Step 10: Backup Strategy

### Create backup script
```bash
sudo nano /var/www/user-management-app/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/user-management-app"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
cp /var/www/user-management-app/backend/users.db $BACKUP_DIR/users_$DATE.db

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/user-management-app

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Make backup script executable
```bash
chmod +x /var/www/user-management-app/backup.sh
```

### Add to crontab for daily backups
```bash
crontab -e
# Add this line:
0 2 * * * /var/www/user-management-app/backup.sh
```

## Troubleshooting

### Check if services are running
```bash
sudo systemctl status nginx
pm2 status
```

### Restart services if needed
```bash
sudo systemctl restart nginx
pm2 restart user-management-backend
```

### Check logs for errors
```bash
pm2 logs user-management-backend --lines 50
sudo journalctl -u nginx -f
```

## Security Considerations

1. **Keep system updated**: `sudo apt update && sudo apt upgrade`
2. **Use strong passwords**: For database and admin accounts
3. **Regular backups**: Automated daily backups
4. **Monitor logs**: Check for suspicious activity
5. **Firewall**: Only open necessary ports
6. **SSL**: Always use HTTPS in production
7. **Environment variables**: Never commit .env files to version control

## Performance Optimization

1. **Enable gzip compression** in Nginx
2. **Use PM2 cluster mode** for multiple CPU cores
3. **Implement caching** for static assets
4. **Monitor resource usage** with `htop` or `pm2 monit`

## Maintenance Commands

```bash
# Update application
cd /var/www/user-management-app
git pull origin main
npm install
npm run build
pm2 restart user-management-backend

# Update system
sudo apt update && sudo apt upgrade -y

# Check disk space
df -h

# Check memory usage
free -h

# View running processes
pm2 status
```

Your application should now be accessible at `https://yourdomain.com`!
