# 🔐 תצורת Environment Variables

## 📋 כללי ברזל (Iron Rules)

### Production
- **אם `SECRET_KEY` או `DATABASE_URL` חסרים → האפליקציה תיפול מיד**
- **אם `ENV=production` → חובה להגדיר את כל ה-secrets**
- **SQLite אסור ב-production**

### Development
- **Defaults מותרים** - האפליקציה תעבוד גם בלי הגדרות
- **SQLite מותר** - default: `sqlite:///./dev.db`

---

## 📁 דוגמאות ל-.env Files

### `.env` (Development)

```bash
# Environment
ENV=development

# Security (defaults allowed)
SECRET_KEY=dev-secret-change-me

# Database (defaults to SQLite)
DATABASE_URL=sqlite:///./dev.db

# CORS (development - allows localhost)
CORS_ORIGINS=http://localhost:5179,http://localhost:5181

# Token Expiry (longer for development)
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Debug
DEBUG=true
```

### `.env` (Production)

```bash
# Environment (MUST be production)
ENV=production

# Security (MANDATORY - MUST be set!)
SECRET_KEY=<strong-random-32-chars-minimum>
# Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"

# Database (MANDATORY - MUST be PostgreSQL!)
DATABASE_URL=postgresql+psycopg://user:pass@db:5432/app

# CORS (production - only your domain)
CORS_ORIGINS=https://app.yourdomain.com

# Token Expiry (shorter for production)
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Debug (MUST be false)
DEBUG=false
```

---

## ✅ Validation Logic

### SECRET_KEY
- **Production**: חובה, מינימום 32 תווים
- **Development**: default: `dev-secret-change-me`

### DATABASE_URL
- **Production**: חובה, אסור SQLite
- **Development**: default: `sqlite:///./dev.db`

### ENV / ENVIRONMENT
- **Values**: `development`, `staging`, `production`
- **Default**: `development`
- **ENV** takes precedence over **ENVIRONMENT**

---

## 🚨 Error Messages

### Production Missing SECRET_KEY
```
ValueError: SECRET_KEY must be set in production!
Use environment variable, Docker secret, or AWS Secrets Manager.
```

### Production Missing DATABASE_URL
```
ValueError: DATABASE_URL must be set in production!
Use environment variable, Docker secret, or AWS Secrets Manager.
```

### Production Using SQLite
```
ValueError: DATABASE_URL cannot use SQLite in production!
Use PostgreSQL or another production database.
```

---

## 🔧 Environment Detection

האפליקציה בודקת את `ENV` או `ENVIRONMENT`:
- `ENV=production` → Production mode (strict validation)
- `ENV=development` → Development mode (allows defaults)
- לא מוגדר → Development mode (default)

---

## 📝 דוגמאות נוספות

### Generate SECRET_KEY
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### PostgreSQL Connection String
```
postgresql+psycopg://username:password@host:port/database
```

### Docker Secrets
האפליקציה תומכת גם ב-Docker secrets:
- `/run/secrets/secret_key`
- `/run/secrets/database_url`

---

## ⚠️ Security Notes

1. **אל תעשה commit של `.env` ל-Git!**
2. **ב-production - השתמש ב-secrets management** (AWS Secrets Manager, HashiCorp Vault, etc.)
3. **SECRET_KEY חייב להיות חזק** - מינימום 32 תווים
4. **DATABASE_URL ב-production חייב להיות PostgreSQL** - לא SQLite
