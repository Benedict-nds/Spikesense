# SpikeSense Deployment Guide

## Production Deployment

This guide covers deploying SpikeSense to production environments.

---

## Backend Deployment

### Option 1: Heroku

#### Prerequisites
- Heroku CLI installed
- Heroku account
- Git repository

#### Steps

1. **Login to Heroku**
```bash
heroku login
```

2. **Create Heroku App**
```bash
cd backend
heroku create spikesense-api
```

3. **Add PostgreSQL Add-on**
```bash
heroku addons:create heroku-postgresql:hobby-dev
```

4. **Set Environment Variables**
```bash
heroku config:set FLASK_ENV=production
heroku config:set SECRET_KEY=your-production-secret-key
```

5. **Deploy**
```bash
git push heroku main
```

6. **Initialize Database**
```bash
heroku run python -c "from app import app, db; app.app_context().push(); db.create_all()"
```

7. **Scale Dynos**
```bash
heroku ps:scale web=1
```

### Option 2: AWS (EC2 + RDS)

#### Prerequisites
- AWS account
- EC2 instance (Ubuntu 20.04+)
- RDS PostgreSQL instance

#### Steps

1. **SSH into EC2 Instance**
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

2. **Install Dependencies**
```bash
sudo apt update
sudo apt install python3-pip python3-venv nginx
```

3. **Clone Repository**
```bash
git clone https://github.com/yourusername/SpikeSense.git
cd SpikeSense/backend
```

4. **Set Up Virtual Environment**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
```

5. **Configure Environment**
```bash
nano .env
# Add:
# DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/spikesense_db
# FLASK_ENV=production
# SECRET_KEY=your-secret-key
```

6. **Create Gunicorn Service**
```bash
sudo nano /etc/systemd/system/spikesense.service
```

Add:
```ini
[Unit]
Description=SpikeSense Flask App
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/SpikeSense/backend
Environment="PATH=/home/ubuntu/SpikeSense/backend/venv/bin"
ExecStart=/home/ubuntu/SpikeSense/backend/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 app:app

[Install]
WantedBy=multi-user.target
```

7. **Start Service**
```bash
sudo systemctl start spikesense
sudo systemctl enable spikesense
```

8. **Configure Nginx**
```bash
sudo nano /etc/nginx/sites-available/spikesense
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/spikesense /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

9. **Set Up SSL (Let's Encrypt)**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Option 3: Docker

#### Create Dockerfile

```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

#### Build and Run

```bash
docker build -t spikesense-backend .
docker run -p 5000:5000 --env-file .env spikesense-backend
```

#### Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/spikesense_db
      - FLASK_ENV=production
      - SECRET_KEY=${SECRET_KEY}
    depends_on:
      - db

  db:
    image: postgres:14
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=spikesense_db
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

```bash
docker-compose up -d
```

---

## Mobile App Deployment

### Android

#### Using EAS Build

1. **Install EAS CLI**
```bash
npm install -g eas-cli
```

2. **Login**
```bash
eas login
```

3. **Configure eas.json**
```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

4. **Build**
```bash
eas build --platform android --profile production
```

5. **Submit to Play Store**
```bash
eas submit --platform android
```

#### Manual Build

```bash
cd android
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

### iOS

#### Using EAS Build

1. **Configure Apple Developer Account**
   - Add Apple ID to EAS
   - Configure certificates

2. **Build**
```bash
eas build --platform ios --profile production
```

3. **Submit to App Store**
```bash
eas submit --platform ios
```

#### Manual Build (Requires macOS)

```bash
cd ios
pod install
xcodebuild -workspace Natively.xcworkspace \
  -scheme Natively \
  -configuration Release \
  -archivePath build/Natively.xcarchive \
  archive
```

---

## Environment Configuration

### Backend Production Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
FLASK_ENV=production
SECRET_KEY=strong-random-secret-key-here
PORT=5000
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

### Mobile App Production Configuration

Update `services/api.ts`:

```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:5000/api'
  : 'https://api.spikesense.app/api';  // Production URL
```

---

## Database Migrations

### Using Flask-Migrate (Recommended)

1. **Install Flask-Migrate**
```bash
pip install flask-migrate
```

2. **Initialize**
```bash
flask db init
```

3. **Create Migration**
```bash
flask db migrate -m "Initial migration"
```

4. **Apply Migration**
```bash
flask db upgrade
```

---

## Monitoring and Logging

### Backend Logging

Configure logging in `app.py`:

```python
import logging
from logging.handlers import RotatingFileHandler

if not app.debug:
    file_handler = RotatingFileHandler('logs/spikesense.log', maxBytes=10240, backupCount=10)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
```

### Health Checks

Implement health check endpoint:

```python
@app.route('/api/health')
def health():
    try:
        db.session.execute('SELECT 1')
        return jsonify({'status': 'healthy', 'database': 'connected'}), 200
    except:
        return jsonify({'status': 'unhealthy', 'database': 'disconnected'}), 503
```

---

## Security Checklist

- [ ] Use HTTPS for all API endpoints
- [ ] Set strong SECRET_KEY
- [ ] Enable CORS only for trusted origins
- [ ] Use environment variables for sensitive data
- [ ] Enable database encryption
- [ ] Implement rate limiting
- [ ] Add authentication/authorization
- [ ] Regular security updates
- [ ] Enable database backups
- [ ] Monitor for security vulnerabilities

---

## Performance Optimization

### Backend

- Use connection pooling
- Enable database indexing
- Implement caching (Redis)
- Use CDN for static assets
- Enable gzip compression

### Mobile App

- Optimize bundle size
- Implement code splitting
- Use image optimization
- Enable lazy loading
- Optimize API calls

---

## Backup Strategy

### Database Backups

**Automated Backups (PostgreSQL)**:
```bash
# Daily backup script
pg_dump -h localhost -U postgres spikesense_db > backup_$(date +%Y%m%d).sql
```

**Heroku**:
```bash
heroku pg:backups:capture
heroku pg:backups:download
```

**AWS RDS**:
- Enable automated backups in RDS console
- Set retention period (7-35 days)

---

## Troubleshooting

### Backend Issues

**Database Connection Errors**:
- Check DATABASE_URL
- Verify network connectivity
- Check firewall rules

**High Memory Usage**:
- Reduce Gunicorn workers
- Implement caching
- Optimize database queries

### Mobile App Issues

**Build Failures**:
- Clear cache: `npm start -- --reset-cache`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Expo SDK version compatibility

**API Connection Errors**:
- Verify API_BASE_URL
- Check CORS settings
- Verify SSL certificates

---

## Scaling

### Horizontal Scaling

- Use load balancer (AWS ALB, Nginx)
- Deploy multiple backend instances
- Use database read replicas

### Vertical Scaling

- Increase server resources
- Optimize database queries
- Implement caching layer

---

## Cost Estimation

### Backend (Heroku)
- Hobby Dyno: $7/month
- Postgres Hobby: $0-9/month
- **Total**: ~$16/month

### Backend (AWS)
- EC2 t3.micro: ~$10/month
- RDS db.t3.micro: ~$15/month
- **Total**: ~$25/month

### Mobile App
- EAS Build: Free tier available
- App Store: $99/year (iOS)
- Play Store: $25 one-time (Android)

---

For more details, see [INSTALLATION.md](INSTALLATION.md) and [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

