# KOmcp Deployment Guide

**Version:** 1.0
**Date:** 2025-12-01
**Target:** Production VPS Deployment

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Docker Deployment](#docker-deployment)
4. [Nginx Configuration](#nginx-configuration)
5. [SSL/TLS Setup](#ssltls-setup)
6. [Environment Configuration](#environment-configuration)
7. [Database Setup](#database-setup)
8. [Deployment Process](#deployment-process)
9. [Monitoring & Logging](#monitoring--logging)
10. [Troubleshooting](#troubleshooting)
11. [Rollback Procedure](#rollback-procedure)

---

## Prerequisites

### VPS Requirements

**Minimum Specifications:**
- **CPU:** 2 cores
- **RAM:** 4 GB
- **Storage:** 20 GB SSD
- **OS:** Ubuntu 22.04 LTS or similar
- **Network:** Public IP address with port 443 accessible

**Recommended Specifications:**
- **CPU:** 4 cores
- **RAM:** 8 GB
- **Storage:** 40 GB SSD

### Software Requirements

Install these on your VPS:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Install Nginx
sudo apt install nginx -y

# Install Certbot (for SSL)
sudo apt install certbot python3-certbot-nginx -y

# Install Git
sudo apt install git -y

# Install Node.js (for local testing)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### DNS Configuration

Point your domain to the VPS IP address:

```
Type: A
Name: mcp (or your subdomain)
Value: <VPS_IP_ADDRESS>
TTL: 3600
```

Example: `mcp.example.com → 192.168.1.100`

Verify DNS propagation:
```bash
dig mcp.example.com
# or
nslookup mcp.example.com
```

---

## Infrastructure Setup

### Directory Structure

Create deployment directories on VPS:

```bash
# Create project directory
mkdir -p /opt/komcp
cd /opt/komcp

# Create subdirectories
mkdir -p logs nginx/ssl docker data

# Set permissions
sudo chown -R $USER:$USER /opt/komcp
chmod 755 /opt/komcp
```

### Firewall Configuration

Configure UFW (Uncomplicated Firewall):

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw --force enable

# Check status
sudo ufw status verbose
```

---

## Docker Deployment

### 1. Clone Repository

```bash
cd /opt/komcp
git clone https://github.com/TillMatthis/KOmcp.git .
git checkout main  # or your production branch
```

### 2. Create Dockerfile

Create `docker/Dockerfile`:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S komcp && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G komcp -g komcp komcp

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=komcp:komcp /app/dist ./dist
COPY --from=builder --chown=komcp:komcp /app/node_modules ./node_modules
COPY --from=builder --chown=komcp:komcp /app/package*.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Switch to non-root user
USER komcp

# Expose port
EXPOSE 3003

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
```

### 3. Create Docker Compose File

Create `docker/docker-compose.yml`:

```yaml
version: '3.8'

services:
  komcp:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    container_name: komcp
    restart: unless-stopped
    ports:
      - "127.0.0.1:3003:3003"  # Only expose to localhost (Nginx will proxy)
    environment:
      - NODE_ENV=production
      - PORT=3003
      - HOST=0.0.0.0
    env_file:
      - ../.env
    volumes:
      - ../logs:/app/logs:rw
    networks:
      - komcp-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3003/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  komcp-network:
    driver: bridge
```

### 4. Build and Start

```bash
# Build Docker image
cd /opt/komcp/docker
docker compose build

# Start services
docker compose up -d

# Check logs
docker compose logs -f komcp

# Verify container is running
docker compose ps
```

---

## Nginx Configuration

### 1. Create Nginx Configuration

Create `/etc/nginx/sites-available/komcp`:

```nginx
# Upstream backend
upstream komcp_backend {
    server 127.0.0.1:3003 fail_timeout=10s max_fails=3;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name mcp.example.com;

    # Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name mcp.example.com;

    # SSL certificates (will be configured by Certbot)
    ssl_certificate /etc/letsencrypt/live/mcp.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.example.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logging
    access_log /var/log/nginx/komcp_access.log;
    error_log /var/log/nginx/komcp_error.log warn;

    # Proxy settings
    location / {
        proxy_pass http://komcp_backend;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # Connection settings
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Limits
        client_max_body_size 1M;
    }

    # Health check endpoint (no caching)
    location /health {
        proxy_pass http://komcp_backend/health;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        access_log off;
    }

    # OAuth metadata endpoint (cache for 1 hour)
    location /.well-known/oauth-protected-resource {
        proxy_pass http://komcp_backend/.well-known/oauth-protected-resource;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_cache_valid 200 1h;
    }
}
```

### 2. Enable Nginx Configuration

```bash
# Test configuration
sudo nginx -t

# Create symbolic link
sudo ln -s /etc/nginx/sites-available/komcp /etc/nginx/sites-enabled/

# Reload Nginx
sudo systemctl reload nginx

# Check status
sudo systemctl status nginx
```

---

## SSL/TLS Setup

### Using Let's Encrypt (Recommended)

```bash
# Create webroot directory
sudo mkdir -p /var/www/certbot

# Obtain SSL certificate
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d mcp.example.com \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email

# Verify certificate
sudo certbot certificates

# Test auto-renewal
sudo certbot renew --dry-run

# Set up auto-renewal (cron)
sudo crontab -e
# Add this line:
0 3 * * * certbot renew --quiet --deploy-hook "systemctl reload nginx"
```

### Manual SSL Certificate

If you have your own certificate:

```bash
# Copy certificates
sudo cp your-cert.pem /etc/nginx/ssl/komcp.crt
sudo cp your-key.pem /etc/nginx/ssl/komcp.key

# Set permissions
sudo chmod 600 /etc/nginx/ssl/komcp.key
sudo chmod 644 /etc/nginx/ssl/komcp.crt

# Update Nginx config to use these paths
```

---

## Environment Configuration

### 1. Create Production .env

Create `/opt/komcp/.env`:

```bash
# =============================================================================
# KOmcp Production Environment
# =============================================================================

# Server Configuration
NODE_ENV=production
PORT=3003
HOST=0.0.0.0
BASE_URL=https://mcp.example.com

# KOauth OAuth2 Integration
KOAUTH_URL=https://auth.example.com
KOAUTH_JWKS_URL=https://auth.example.com/.well-known/jwks.json
KOAUTH_CLIENT_REGISTRATION_URL=https://auth.example.com/oauth/register

# Kura Database (Read-Only)
KURA_DATABASE_URL=postgresql://komcp_readonly:CHANGE_ME@kura-db.example.com:5432/kura

# Security
ALLOWED_ORIGINS=https://claude.ai,https://desktop.claude.ai
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# Logging
LOG_LEVEL=info

# Optional: Monitoring
# SENTRY_DSN=https://...
```

### 2. Secure Environment File

```bash
# Set restrictive permissions
chmod 600 /opt/komcp/.env
chown $USER:$USER /opt/komcp/.env

# Verify
ls -la /opt/komcp/.env
```

---

## Database Setup

### Create Read-Only Database User

Connect to Kura's PostgreSQL database:

```bash
psql -h kura-db.example.com -U postgres -d kura
```

Create read-only user:

```sql
-- Create user
CREATE USER komcp_readonly WITH PASSWORD 'STRONG_PASSWORD_HERE';

-- Grant connect privilege
GRANT CONNECT ON DATABASE kura TO komcp_readonly;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO komcp_readonly;

-- Grant SELECT on notes table
GRANT SELECT ON public.notes TO komcp_readonly;

-- Grant SELECT on sequences (for Prisma)
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO komcp_readonly;

-- Verify permissions
\du komcp_readonly
\dp notes
```

### Test Database Connection

From VPS:

```bash
# Test connection
psql "postgresql://komcp_readonly:PASSWORD@kura-db.example.com:5432/kura" -c "SELECT COUNT(*) FROM notes;"

# Test with Prisma
cd /opt/komcp
npx prisma db pull
```

---

## Deployment Process

### Initial Deployment

```bash
#!/bin/bash
# deploy.sh - Initial deployment script

set -e  # Exit on error

echo "Starting KOmcp deployment..."

# 1. Pull latest code
cd /opt/komcp
git pull origin main

# 2. Install/update dependencies
npm ci --only=production

# 3. Generate Prisma client
npx prisma generate

# 4. Build TypeScript
npm run build

# 5. Build Docker image
cd docker
docker compose build

# 6. Stop existing containers
docker compose down

# 7. Start new containers
docker compose up -d

# 8. Wait for health check
echo "Waiting for service to be healthy..."
sleep 10

# 9. Verify deployment
HEALTH=$(curl -s http://localhost:3003/health | jq -r '.status')
if [ "$HEALTH" = "healthy" ]; then
    echo "✅ Deployment successful!"
    docker compose logs --tail=50 komcp
else
    echo "❌ Deployment failed - service unhealthy"
    docker compose logs --tail=100 komcp
    exit 1
fi

# 10. Cleanup old images
docker image prune -f

echo "Deployment complete!"
```

Make executable:

```bash
chmod +x /opt/komcp/scripts/deploy.sh
```

### Zero-Downtime Deployment (Advanced)

For zero-downtime deployments, use blue-green deployment:

```bash
# Start new version on different port
docker compose -f docker-compose.blue.yml up -d

# Wait for health check
./scripts/health-check.sh localhost:3004

# Switch Nginx upstream to new version
sudo systemctl reload nginx

# Stop old version
docker compose -f docker-compose.green.yml down
```

---

## Monitoring & Logging

### View Logs

```bash
# Docker logs
docker compose logs -f komcp

# Nginx access logs
sudo tail -f /var/log/nginx/komcp_access.log

# Nginx error logs
sudo tail -f /var/log/nginx/komcp_error.log

# Application logs (if written to file)
tail -f /opt/komcp/logs/app.log
```

### Log Rotation

Configure log rotation in `/etc/logrotate.d/komcp`:

```
/opt/komcp/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 komcp komcp
    sharedscripts
    postrotate
        docker compose -f /opt/komcp/docker/docker-compose.yml kill -s USR1 komcp
    endscript
}
```

### Health Monitoring

Create `/opt/komcp/scripts/health-check.sh`:

```bash
#!/bin/bash

# Health check script
URL="http://localhost:3003/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $URL)

if [ "$RESPONSE" -eq 200 ]; then
    echo "✅ Service is healthy"
    exit 0
else
    echo "❌ Service is unhealthy (HTTP $RESPONSE)"
    # Send alert (email, Slack, etc.)
    exit 1
fi
```

Add to cron (every 5 minutes):

```bash
crontab -e
# Add:
*/5 * * * * /opt/komcp/scripts/health-check.sh >> /opt/komcp/logs/health.log 2>&1
```

---

## Troubleshooting

### Service Won't Start

**Check logs:**
```bash
docker compose logs komcp
```

**Common issues:**
- Environment variables missing → Check `.env`
- Database connection failed → Test `KURA_DATABASE_URL`
- Port already in use → Check `sudo netstat -tulpn | grep 3003`

### 502 Bad Gateway

**Cause:** Nginx can't connect to backend

**Solutions:**
```bash
# Check if container is running
docker compose ps

# Check health endpoint directly
curl http://localhost:3003/health

# Check Nginx error logs
sudo tail -f /var/log/nginx/komcp_error.log
```

### High Memory Usage

**Check memory:**
```bash
docker stats komcp
```

**Solutions:**
- Increase VPS RAM
- Limit Docker memory: add to docker-compose.yml:
  ```yaml
  deploy:
    resources:
      limits:
        memory: 512M
  ```

### SSL Certificate Expired

**Renew certificate:**
```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

---

## Rollback Procedure

### Quick Rollback

```bash
#!/bin/bash
# rollback.sh

set -e

echo "Starting rollback..."

# 1. Get previous commit
cd /opt/komcp
CURRENT_COMMIT=$(git rev-parse HEAD)
git log --oneline -5

# 2. Ask for commit to rollback to
read -p "Enter commit hash to rollback to: " ROLLBACK_COMMIT

# 3. Checkout commit
git checkout $ROLLBACK_COMMIT

# 4. Rebuild and redeploy
docker compose build
docker compose up -d

# 5. Verify
sleep 10
curl -s http://localhost:3003/health | jq

echo "Rollback complete!"
echo "Current commit: $(git rev-parse HEAD)"
```

---

## Production Checklist

Before going live:

- [ ] DNS configured and propagated
- [ ] SSL certificate installed and valid
- [ ] Firewall configured (UFW)
- [ ] .env file configured with production values
- [ ] Database read-only user created
- [ ] KOauth integration tested
- [ ] Health check endpoint working
- [ ] Logs directory created and writable
- [ ] Log rotation configured
- [ ] Monitoring/alerts set up
- [ ] Backup procedure documented
- [ ] Rollback procedure tested
- [ ] Load testing completed
- [ ] Security audit completed

---

## Related Documentation

- [BUILD-CHECKLIST.md](../BUILD-CHECKLIST.md) - Phase 10 deployment tasks
- [OAuth Integration Guide](./oauth-integration-guide.md) - OAuth setup
- [API Specification](./api-specification.md) - API documentation

---

**Last Updated:** 2025-12-01
