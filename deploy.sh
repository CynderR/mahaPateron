#!/bin/bash

# User Management App Deployment Script
# Run this script on your Debian server

set -e  # Exit on any error

echo "🚀 Starting User Management App deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

# Check if sudo is available
if ! command -v sudo &> /dev/null; then
    print_error "sudo is required but not installed. Please install sudo first."
    exit 1
fi

print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

print_status "Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

print_status "Installing PM2 globally..."
sudo npm install -g pm2

print_status "Installing Nginx..."
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx

print_status "Installing SQLite3..."
sudo apt install sqlite3 -y

print_status "Creating application directory..."
sudo mkdir -p /var/www/user-management-app
sudo chown $USER:$USER /var/www/user-management-app

print_status "Installing application dependencies..."
cd /var/www/user-management-app

# Install backend dependencies
if [ -d "backend" ]; then
    cd backend
    npm install --production
    cd ..
fi

# Install frontend dependencies and build
if [ -f "package.json" ]; then
    npm install
    npm run build
fi

print_status "Setting up environment variables..."
if [ ! -f "backend/.env" ]; then
    print_warning "Creating .env file. Please edit it with your production values."
    cat > backend/.env << EOF
# Production Environment Variables
NODE_ENV=production
PORT=5000

# JWT Secret (CHANGE THIS!)
JWT_SECRET=$(openssl rand -base64 32)

# Database
DATABASE_URL=/var/www/user-management-app/backend/users.db

# CORS Origin (CHANGE THIS!)
CORS_ORIGIN=https://yourdomain.com

# Patreon API (ADD YOUR TOKEN)
PATREON_ACCESS_TOKEN=your-patreon-token-here

# Security
BCRYPT_ROUNDS=12
EOF
fi

print_status "Setting proper permissions..."
sudo chown -R www-data:www-data /var/www/user-management-app
sudo chmod -R 755 /var/www/user-management-app
sudo chmod 600 /var/www/user-management-app/backend/.env

print_status "Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

print_status "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/user-management-app > /dev/null << 'EOF'
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
EOF

sudo ln -sf /etc/nginx/sites-available/user-management-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

print_status "Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

print_status "Creating backup script..."
sudo tee /var/www/user-management-app/backup.sh > /dev/null << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/user-management-app"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
if [ -f "/var/www/user-management-app/backend/users.db" ]; then
    cp /var/www/user-management-app/backend/users.db $BACKUP_DIR/users_$DATE.db
fi

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/user-management-app

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

sudo chmod +x /var/www/user-management-app/backup.sh

print_status "Setting up log rotation..."
sudo tee /etc/logrotate.d/user-management-app > /dev/null << 'EOF'
/var/log/pm2/user-management-backend*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

print_status "Creating admin user..."
if [ -f "backend/create-admin.js" ]; then
    cd backend
    node create-admin.js
    cd ..
fi

print_status "🎉 Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit /var/www/user-management-app/backend/.env with your production values"
echo "2. Update Nginx configuration with your domain name"
echo "3. Install SSL certificate: sudo certbot --nginx -d yourdomain.com"
echo "4. Test your application: http://yourdomain.com"
echo ""
echo "Useful commands:"
echo "- View logs: pm2 logs user-management-backend"
echo "- Restart app: pm2 restart user-management-backend"
echo "- Check status: pm2 status"
echo "- Backup: /var/www/user-management-app/backup.sh"
echo ""
print_warning "Don't forget to:"
echo "- Change the JWT_SECRET in .env"
echo "- Add your Patreon access token"
echo "- Update CORS_ORIGIN with your domain"
echo "- Configure your domain DNS to point to this server"




