# 🚀 Production Deployment Guide

מדריך מפורט לפריסת האפליקציה ל-production.

## 📋 Prerequisites

### Required
- Docker & Docker Compose installed
- PostgreSQL 16+ (or use included Docker service)
- Redis (or use included Docker service)
- Domain name configured (optional, for production)
- SSL/TLS certificates (optional, for HTTPS)

### Optional but Recommended
- Sentry account (for error tracking)
- Monitoring dashboard (Prometheus/Grafana)
- CI/CD pipeline (GitHub Actions, GitLab CI, etc.)

---

## 🔧 Step 1: Environment Setup

### Backend Environment Variables

Create `backend/.env` file:

```bash
# Core
SECRET_KEY=your-strong-secret-key-min-32-chars
DATABASE_URL=postgresql+psycopg2://postgres:password@db:5432/eli_maor
REDIS_URL=redis://redis:6379/0
DEBUG=False
ENVIRONMENT=production

# JWT
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30

# CORS (comma-separated)
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Optional: Sentry
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production

# Optional: Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Optional: Push Notifications
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

**Generate SECRET_KEY:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Frontend Environment Variables

Create `frontend/.env` file:

```bash
VITE_API_URL=https://api.your-domain.com/api
VITE_WS_URL=wss://api.your-domain.com/ws
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

---

## 🐳 Step 2: Docker Build

### Build Images

```bash
# Backend
cd backend
docker build -t eli-maor-backend:latest .

# Frontend
cd ../frontend
docker build -t eli-maor-frontend:latest .
```

Or use Docker Compose:

```bash
docker-compose -f docker-compose.prod.standalone.yml build
```

---

## 🗄️ Step 3: Database Setup

### Option A: Using Docker Compose (Recommended)

The `docker-compose.prod.standalone.yml` includes PostgreSQL automatically.

```bash
docker-compose -f docker-compose.prod.standalone.yml up -d db
```

Wait for database to be ready:
```bash
docker-compose -f docker-compose.prod.standalone.yml logs db | grep "database system is ready"
```

### Option B: External PostgreSQL

If using external PostgreSQL, update `DATABASE_URL` in `.env`:

```bash
DATABASE_URL=postgresql+psycopg2://user:password@host:5432/dbname
```

### Run Migrations

```bash
# Using Docker Compose (automatic)
docker-compose -f docker-compose.prod.standalone.yml up backend

# Or manually
docker exec -it eli_maor_backend alembic upgrade head
```

---

## 🚀 Step 4: Start Services

### Using Docker Compose (Recommended)

```bash
docker-compose -f docker-compose.prod.standalone.yml up -d
```

This starts:
- ✅ PostgreSQL database
- ✅ Redis cache
- ✅ Backend API (with auto-migrations)
- ✅ Celery worker
- ✅ Celery beat
- ✅ Frontend (nginx)

### Verify Services

```bash
# Check all services are running
docker-compose -f docker-compose.prod.standalone.yml ps

# Check backend health
curl http://localhost:8000/health

# Check frontend
curl http://localhost:80/health
```

---

## 🔍 Step 5: Health Checks

### Backend Health Endpoints

- `GET /health` - Basic health check
- `GET /api/health/detailed` - Detailed health (database, Redis, etc.)

### Frontend Health

- `GET /health` - Returns "healthy" if nginx is running

### Monitor Logs

```bash
# All services
docker-compose -f docker-compose.prod.standalone.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.standalone.yml logs -f backend
docker-compose -f docker-compose.prod.standalone.yml logs -f frontend
```

---

## 🔒 Step 6: Security Checklist

### Before Going Live

- [ ] `SECRET_KEY` is strong and unique (32+ characters)
- [ ] `DEBUG=False` in production
- [ ] `DATABASE_URL` uses PostgreSQL (not SQLite)
- [ ] `CORS_ORIGINS` only includes your domain(s)
- [ ] Database password is strong
- [ ] All secrets are in `.env` (not committed to git)
- [ ] SSL/TLS certificates configured (if using HTTPS)
- [ ] Rate limiting enabled
- [ ] Security headers enabled

### Security Headers

The backend automatically sets:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (if HTTPS)
- `Content-Security-Policy` (if configured)

---

## 📊 Step 7: Monitoring Setup

### Sentry (Error Tracking)

1. Create account at [sentry.io](https://sentry.io)
2. Create new project (Python/FastAPI)
3. Copy DSN to `backend/.env`:
   ```bash
   SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   ```
4. Restart backend:
   ```bash
   docker-compose -f docker-compose.prod.standalone.yml restart backend
   ```

### Prometheus Metrics

Metrics are automatically exposed at:
- `GET /metrics` - Prometheus format

### Log Aggregation

Logs are structured (JSON) and can be sent to:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- CloudWatch (AWS)
- Custom log aggregation service

---

## 🔄 Step 8: Updates & Maintenance

### Update Application

```bash
# Pull latest code
git pull

# Rebuild images
docker-compose -f docker-compose.prod.standalone.yml build

# Restart services (zero-downtime with health checks)
docker-compose -f docker-compose.prod.standalone.yml up -d
```

### Database Migrations

Migrations run automatically on backend startup. To run manually:

```bash
docker exec -it eli_maor_backend alembic upgrade head
```

### Backup Database

```bash
# Using Docker
docker exec eli_maor_db pg_dump -U postgres eli_maor > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i eli_maor_db psql -U postgres eli_maor < backup_20240101.sql
```

---

## 🐛 Troubleshooting

### Backend Won't Start

1. Check logs:
   ```bash
   docker-compose -f docker-compose.prod.standalone.yml logs backend
   ```

2. Verify environment variables:
   ```bash
   docker exec eli_maor_backend env | grep -E "SECRET_KEY|DATABASE_URL"
   ```

3. Check database connection:
   ```bash
   docker exec eli_maor_backend python -c "from app.db.session import engine; print(engine.connect())"
   ```

### Frontend 502 Bad Gateway

1. Check backend is running:
   ```bash
   curl http://localhost:8000/health
   ```

2. Check nginx logs:
   ```bash
   docker-compose -f docker-compose.prod.standalone.yml logs frontend
   ```

3. Verify nginx config:
   ```bash
   docker exec eli_maor_frontend nginx -t
   ```

### Database Connection Errors

1. Verify PostgreSQL is running:
   ```bash
   docker-compose -f docker-compose.prod.standalone.yml ps db
   ```

2. Check connection string:
   ```bash
   echo $DATABASE_URL
   ```

3. Test connection:
   ```bash
   docker exec eli_maor_db pg_isready -U postgres
   ```

---

## 📈 Performance Optimization

### Backend

- **Workers**: Adjust `--workers` in Dockerfile CMD (default: 2)
- **Database Pool**: Configure in `app/db/session.py`
- **Caching**: Redis is already configured
- **Rate Limiting**: Adjust in `backend/.env`

### Frontend

- **Static Assets**: Already cached (1 year)
- **Gzip**: Enabled in nginx
- **Code Splitting**: Already configured in `vite.config.ts`

### Database

- **Connection Pooling**: Configured in SQLAlchemy
- **Indexes**: Add indexes for frequently queried columns
- **Vacuum**: Run `VACUUM ANALYZE` periodically

---

## 🔐 Production Best Practices

### Secrets Management

**DO:**
- ✅ Use environment variables
- ✅ Use Docker secrets (`/run/secrets/`)
- ✅ Use AWS Secrets Manager / HashiCorp Vault
- ✅ Rotate secrets regularly

**DON'T:**
- ❌ Commit secrets to git
- ❌ Hardcode secrets in code
- ❌ Share secrets in logs

### Database

- ✅ Use PostgreSQL in production (never SQLite)
- ✅ Enable SSL connections
- ✅ Regular backups (daily recommended)
- ✅ Monitor database size and performance

### Monitoring

- ✅ Set up error tracking (Sentry)
- ✅ Monitor API response times
- ✅ Set up alerts for critical errors
- ✅ Track user metrics (anonymized)

---

## 📞 Support & Resources

### Documentation
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [React Query Docs](https://tanstack.com/query/latest)
- [Docker Compose Docs](https://docs.docker.com/compose/)

### Health Check URLs
- Backend: `http://your-domain:8000/health`
- Frontend: `http://your-domain/health`
- Metrics: `http://your-domain:8000/metrics`

---

## ✅ Deployment Checklist

Before going live, verify:

- [ ] All environment variables set
- [ ] Database migrations applied
- [ ] Health checks passing
- [ ] SSL/TLS configured (if using HTTPS)
- [ ] CORS origins configured
- [ ] Rate limiting enabled
- [ ] Error tracking configured (Sentry)
- [ ] Monitoring dashboards set up
- [ ] Backups configured
- [ ] Documentation updated

---

**🎉 Ready for Production!**

For questions or issues, check logs first:
```bash
docker-compose -f docker-compose.prod.standalone.yml logs -f
```
