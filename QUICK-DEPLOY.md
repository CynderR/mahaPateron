# Quick Deployment Guide

## Option 1: Automated Deployment (Recommended)

1. **Upload your application to the server:**
   ```bash
   # From your local machine
   scp -r /home/j/maha/user-management-app/* user@your-server:/var/www/user-management-app/
   ```

2. **Run the deployment script on your server:**
   ```bash
   ssh user@your-server
   cd /var/www/user-management-app
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **Configure your domain:**
   ```bash
   sudo nano /etc/nginx/sites-available/user-management-app
   # Replace 'yourdomain.com' with your actual domain
   sudo nginx -t && sudo systemctl reload nginx
   ```

4. **Install SSL certificate:**
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d yourdomain.com
   ```

## Option 2: Manual Deployment

Follow the detailed steps in `DEPLOYMENT.md`

## Post-Deployment Checklist

- [ ] Update `.env` file with production values
- [ ] Configure domain DNS to point to your server
- [ ] Install SSL certificate
- [ ] Test the application
- [ ] Create admin user
- [ ] Set up monitoring

## Useful Commands

```bash
# Check application status
pm2 status

# View logs
pm2 logs user-management-backend

# Restart application
pm2 restart user-management-backend

# Check Nginx status
sudo systemctl status nginx

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
```

## Troubleshooting

If something goes wrong:

1. **Check PM2 logs:** `pm2 logs user-management-backend`
2. **Check Nginx logs:** `sudo tail -f /var/log/nginx/error.log`
3. **Restart services:** `pm2 restart all && sudo systemctl restart nginx`
4. **Check firewall:** `sudo ufw status`

## Security Notes

- Change default passwords
- Use strong JWT secrets
- Keep system updated
- Monitor logs regularly
- Set up automated backups






