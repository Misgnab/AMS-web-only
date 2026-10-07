# BuildTrack AMS — Enterprise Production Deployment Guide
**Nabi Tech PLC | Attendance, Leave & Enterprise Payroll Management System**

This comprehensive guide provides production-ready deployment strategies, configurations, security hardening procedures, and database backup routines for **BuildTrack AMS**.

---

## 📋 System Architecture & Requirements

BuildTrack AMS is built on a high-performance full-stack architecture:
- **Backend**: Node.js 20+ with Express, TypeScript, MySQL2, and JWT cryptographic verification.
- **Frontend**: React 19, Tailwind CSS v4, Motion animations, Lucide icons, and HTML5 WebRTC QR scanner.
- **Database**: Pure Enterprise MySQL / MariaDB (InnoDB engine) with utf8mb4 encoding, foreign-key constraints, and automated transaction pooling.
- **Localization Engine**: Built-in Ethiopian 13-month calendar converter (`ethiopian-date`) and Ethiopian 12-hour local clock offset engine.
- **Network Port**: External container ingress and internal server bind to `0.0.0.0:3000`.

### Minimum Server Requirements
| Resource | Minimum Spec | Recommended (500+ Staff) |
| :--- | :--- | :--- |
| **CPU** | 1 vCPU (2.0 GHz+) | 2+ vCPUs |
| **RAM** | 1 GB RAM | 2 GB to 4 GB RAM |
| **Disk Storage** | 10 GB SSD (NVMe preferred) | 25+ GB SSD (for MySQL data & backups) |
| **Node.js** | v20.x or v22.x LTS | v22.x LTS |
| **SSL/HTTPS** | **Mandatory** for GPS Geolocation & Camera Access | Strict HTTPS (TLS 1.3 / Let's Encrypt) |

> ⚠️ **HTTPS Requirement Notice**: Modern web browsers strictly restrict `navigator.geolocation` and `navigator.mediaDevices.getUserMedia` (QR camera scanner) to secure HTTPS contexts or `localhost`. Production deployments **must** terminate SSL/TLS.

---

## 🚀 Option 1: Google Cloud Run (Recommended for Cloud)

Google Cloud Run offers serverless container execution with auto-scaling, built-in HTTPS, and seamless traffic management.

### Step 1: Set Google Cloud Project & Artifact Registry
```bash
# Authenticate with Google Cloud
gcloud auth login

# Set your active GCP project ID
gcloud config set project YOUR_GCP_PROJECT_ID

# Enable Cloud Run & Artifact Registry APIs
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
```

### Step 2: Build & Push Container Image
```bash
# Build and submit the container to Google Cloud Build
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT_ID/buildtrack-ams:latest .
```

### Step 3: Deploy to Cloud Run
```bash
gcloud run deploy buildtrack-ams \
  --image gcr.io/YOUR_GCP_PROJECT_ID/buildtrack-ams:latest \
  --platform managed \
  --region europe-west2 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,JWT_SECRET=your_super_secret_jwt_random_key_64_chars_min,APP_URL=https://your-custom-domain.com"
```

*Note: For MySQL persistence on Cloud Run, connect to Google Cloud SQL (MySQL instance) via Cloud SQL Auth Proxy or a private VPC connector, setting `MYSQL_HOST`, `MYSQL_USER`, and `MYSQL_PASSWORD`.*

---

## 🐳 Option 2: Docker & Docker Compose (Any VPS / On-Premise)

Docker containerization packages all system dependencies into an isolated, reproducible container.

### Step 1: Ensure Files are Present
Ensure `Dockerfile` and `docker-compose.yml` are in your project root.

### Step 2: Build and Run with Docker Compose
```bash
# Clone repository or pull files onto your server
cd /opt/buildtrack-ams

# Start the application in detached mode with persistent volume mounting
docker compose up -d --build

# Verify container status
docker compose ps

# Inspect live application logs
docker compose logs -f app
```

### Step 3: Verify Persistence
The `docker-compose.yml` mounts the named volume `mysql_data` ensuring all MySQL tables and operational records persist across container restarts, image upgrades, and deployments.

---

## 🖥️ Option 3: Ubuntu / Debian Linux VPS (Bare Metal / VM)

### Step 1: Update System & Install Node.js 22 LTS and MySQL Server
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential mysql-server nginx certbot python3-certbot-nginx

# Install Node.js 22 LTS from NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v   # Should output v22.x.x
npm -v    # Should output 10.x.x
```

### Step 2: Clone & Install Dependencies
```bash
# Create application directory
sudo mkdir -p /var/www/buildtrack
sudo chown -R $USER:$USER /var/www/buildtrack
cd /var/www/buildtrack

# Copy or clone project code
# Run production installation & build
npm ci
npm run build
```

### Step 3: Run Automated Verification Suite
```bash
# Execute the automated 29-test verification suite
npm test
```

### Step 4: Configure Systemd Service
Create the service unit file:
```bash
sudo nano /etc/systemd/system/buildtrack.service
```

Paste the following configuration:
```ini
[Unit]
Description=BuildTrack AMS - Attendance & Leave Management Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/buildtrack
ExecStart=/usr/bin/node /var/www/buildtrack/dist/server.cjs
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=JWT_SECRET=production_random_jwt_secret_99882233
Environment=APP_URL=https://attendance.nabitechplc.com

# Resource Limits
LimitNOFILE=65536
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
# Set appropriate permissions for www-data
sudo chown -R www-data:www-data /var/www/buildtrack

# Reload systemd, enable and start
sudo systemctl daemon-reload
sudo systemctl enable buildtrack
sudo systemctl start buildtrack
sudo systemctl status buildtrack
```

### Step 5: (Alternative) Process Management with PM2
If you prefer PM2:
```bash
sudo npm install -g pm2
pm2 start dist/server.cjs --name "buildtrack-ams" --env NODE_ENV=production
pm2 save
pm2 startup
```

---

## 🔒 Option 4: Nginx Reverse Proxy with SSL (HTTPS)

### Step 1: Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/buildtrack.conf
```

Add the following Nginx block:
```nginx
server {
    listen 80;
    server_name attendance.nabitechplc.com;

    # Client payload limit for high-res QR scanning logs and photo uploads
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # WebSocket and connection headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Real client IP and proxy forwarding
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for sustained queries and reporting
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### Step 2: Enable Site and Obtain Free SSL Certificate
```bash
# Enable Nginx virtual host
sudo ln -s /etc/nginx/sites-available/buildtrack.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue automated Let's Encrypt TLS Certificate
sudo certbot --nginx -d attendance.nabitechplc.com --non-interactive --agree-tos -m admin@nabitechplc.com --redirect
```

---

## 💾 Database Persistence & Automated Backup Procedures

BuildTrack AMS stores operational records exclusively in MySQL (`buildtrack_ams`) with full ACID compliance and transaction isolation.

### 1. MySQL Online Backup Command (mysqldump)
Create a point-in-time SQL snapshot without interrupting running transactions:
```bash
# Export single-transaction consistent dump
mysqldump -u root -p --single-transaction --quick buildtrack_ams > /var/backups/buildtrack/buildtrack_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Automated Daily Backup Cron Job
Install the automated backup script located at `scripts/backup-db.sh`:
```bash
sudo chmod +x /var/www/buildtrack/scripts/backup-db.sh

# Open crontab for root or www-data
sudo crontab -e
```

Add a daily automated backup at 02:00 AM (local time):
```cron
# Daily MySQL backup at 2:00 AM with 30-day retention and gzip compression
0 2 * * * /var/www/buildtrack/scripts/backup-db.sh >> /var/log/buildtrack-backup.log 2>&1
```

### 3. Database Restore Procedure
To restore from a backup SQL snapshot:
```bash
# 1. Stop the application service
sudo systemctl stop buildtrack

# 2. Re-import the verified SQL snapshot into MySQL
mysql -u root -p buildtrack_ams < /var/backups/buildtrack/buildtrack_ams_YYYYMMDD_HHMMSS.sql

# 3. Restart the service and verify health
sudo systemctl start buildtrack
curl -f http://localhost:3000/api/health
```

---

## 🔑 Environment Variables Matrix

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables production optimizations, gzip caching, and secure cookies. |
| `PORT` | Optional | `3000` | Ingress and server binding port. |
| `JWT_SECRET` | **Mandatory** | `secret_string_min_32_chars` | Cryptographic signature key for session JWTs and RBAC security tokens. |
| `APP_URL` | Recommended | `https://attendance.nabitechplc.com` | Base origin for QR codes, callback links, and CORS headers. |
| `GEMINI_API_KEY` | Optional | `AIzaSy...` | Server-side Gemini AI key for enterprise summarization and reporting. |

---

## 🛡️ Production Security Checklist

- [x] **Strict Role Hierarchy**: Only `SuperAdmin` can delete staff or alter system-wide company settings.
- [x] **Device Fingerprint Binding**: Mobile check-ins authenticate hardware device IDs to prevent buddy-punching.
- [x] **Geofencing Haversine Validation**: GPS coordinates are verified server-side against office radius.
- [x] **Static QR Code Signature**: Workspace QR codes rotate or require valid office Wi-Fi / GPS proximity.
- [x] **Bcrypt Password Salt**: All passwords hashed with 10 rounds of Bcrypt.
- [x] **Progressive Tax & Pension Compliance**: Ethiopian Income Tax Law (Proclamation No. 979/2016) and 7% + 11% pension formulas enforced.
- [x] **29-Test Automated Verification**: All unit, integration, security, and payroll calculus verified with `npm test`.

---

## 📞 DevOps & Technical Support
For enterprise custom deployments, multi-branch geofence calibration, or Cloud Run architecture assistance, contact:
- **Company**: Nabi Tech PLC
- **Website**: [nabitechplc.com](https://nabitechplc.com)
- **Phone**: `0911149746`
