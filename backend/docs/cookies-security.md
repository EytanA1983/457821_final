# Cookie Security Configuration

## Overview

המערכת כוללת תמיכה מלאה ב-secure cookies עם הגדרות אבטחה מחמירות:
- **SameSite=Strict** - מגן מפני CSRF attacks
- **Secure flag** - cookies נשלחים רק ב-HTTPS (בפרודקשן)
- **HttpOnly flag** - מונע גישה ל-cookies מ-JavaScript (XSS protection)

## הגדרות

### Environment Variables

```bash
# Cookie settings
COOKIE_SECURE=true              # Enable Secure flag (HTTPS only)
COOKIE_HTTPONLY=true             # Enable HttpOnly flag (XSS protection)
COOKIE_SAMESITE=Strict           # SameSite policy: Strict, Lax, or None
COOKIE_DOMAIN=                   # Optional: cookie domain (for cross-subdomain)
COOKIE_PATH=/                    # Cookie path (default: /)

# Session cookie (if using session-based auth)
SESSION_COOKIE_NAME=session
SESSION_COOKIE_MAX_AGE=2592000  # 30 days in seconds
```

### Production vs Development

- **Development (HTTP):**
  - `COOKIE_SECURE=false` - מאפשר cookies ב-HTTP (localhost)
  - `COOKIE_HTTPONLY=true` - עדיין מופעל (XSS protection)
  - `COOKIE_SAMESITE=Strict` - מופעל תמיד

- **Production (HTTPS):**
  - `COOKIE_SECURE=true` - מופעל אוטומטית אם `IS_PRODUCTION=true`
  - `COOKIE_HTTPONLY=true` - מופעל תמיד
  - `COOKIE_SAMESITE=Strict` - מופעל תמיד

## Middleware

### SecureCookieMiddleware

ה-middleware מוסיף אוטומטית את כל ה-security attributes לכל cookie שנשלח:

```python
from app.api.cookie_middleware import SecureCookieMiddleware

app.add_middleware(SecureCookieMiddleware)
```

**מיקום:** חייב להיות אחרי `CORSMiddleware` (כי צריך `allow_credentials=True`)

### Helper Functions

#### set_secure_cookie()

```python
from fastapi import Response
from app.api.cookie_middleware import set_secure_cookie

@router.post("/login")
def login(response: Response):
    # Set secure cookie
    set_secure_cookie(
        response=response,
        key="access_token",
        value=token,
        max_age=900,  # 15 minutes
        httponly=True,
        samesite="Strict"
    )
    return {"status": "ok"}
```

#### delete_cookie()

```python
from app.api.cookie_middleware import delete_cookie

@router.post("/logout")
def logout(response: Response):
    delete_cookie(response, key="access_token")
    return {"status": "logged out"}
```

## CORS Configuration

**חשוב:** `allow_credentials=True` הוא חובה עבור cookies!

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5179", ...],
    allow_credentials=True,  # REQUIRED for cookies!
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## שימוש ב-Cookies במקום localStorage

### Option 1: HttpOnly Cookies (מומלץ לאבטחה)

**יתרונות:**
- ✅ לא נגיש מ-JavaScript (XSS protection)
- ✅ נשלח אוטומטית בכל request
- ✅ SameSite=Strict מגן מפני CSRF

**חסרונות:**
- ❌ לא נגיש מ-JavaScript (צריך לשלוח ב-request headers)
- ❌ מורכב יותר לניהול

**דוגמה:**

```python
# Backend: auth.py
@router.post("/login", response_model=Token)
def login(response: Response, ...):
    # Set HttpOnly cookie
    set_secure_cookie(
        response=response,
        key="access_token",
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        samesite="Strict"
    )

    # Return response (cookie is set automatically)
    return Token(access_token=access_token, ...)
```

```typescript
// Frontend: axios interceptor
axios.interceptors.request.use((config) => {
  // Cookies are sent automatically by browser
  // No need to manually add token!
  return config;
});
```

### Option 2: localStorage (נוכחי)

**יתרונות:**
- ✅ פשוט לניהול
- ✅ נגיש מ-JavaScript
- ✅ לא נשלח אוטומטית (פחות סיכון)

**חסרונות:**
- ❌ פגיע ל-XSS attacks
- ❌ צריך לשלוח ידנית ב-request headers

**דוגמה:**

```typescript
// Frontend: current implementation
localStorage.setItem('token', token);
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

## המלצות

### לאפליקציות רגילות (SPA):
- **localStorage** - פשוט יותר, מספיק לאבטחה בסיסית
- **HttpOnly Cookies** - אם יש דרישות אבטחה מחמירות

### לאפליקציות רגישות:
- **HttpOnly Cookies + SameSite=Strict** - הגנה מקסימלית
- **CSRF tokens** - אם משתמשים ב-cookies

## Testing

### בדיקת Cookies ב-Development

```bash
# בדוק שהקוקי נשלח עם כל ה-attributes
curl -v http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test@example.com&password=test123" \
  -c cookies.txt

# בדוק את הקוקי שנשמר
cat cookies.txt
```

**צפוי לראות:**
```
access_token=...; Path=/; SameSite=Strict; HttpOnly
```

### בדיקת Cookies ב-Production (HTTPS)

```bash
curl -v https://api.example.com/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test@example.com&password=test123" \
  -c cookies.txt

# צפוי לראות גם Secure flag
cat cookies.txt
```

**צפוי לראות:**
```
access_token=...; Path=/; SameSite=Strict; Secure; HttpOnly
```

## Troubleshooting

### Cookies לא נשלחים

1. **בדוק CORS:**
   ```python
   allow_credentials=True  # Must be True!
   ```

2. **בדוק SameSite:**
   - `Strict` - לא עובד cross-site
   - `Lax` - עובד עם GET requests cross-site
   - `None` - עובד תמיד (דורש `Secure`)

3. **בדוק Secure flag:**
   - ב-HTTP (localhost): `COOKIE_SECURE=false`
   - ב-HTTPS: `COOKIE_SECURE=true`

### Cookies לא נשלחים ב-Cross-Origin

**בעיה:** Cookies לא נשלחים מ-`http://localhost:5179` ל-`http://localhost:8000`

**פתרון:**
1. ודא `allow_credentials=True` ב-CORS
2. ודא `SameSite=None` + `Secure=true` (אם צריך cross-site)
3. או השתמש ב-`SameSite=Lax` (עובד רק עם GET requests)

## Security Best Practices

1. **תמיד השתמש ב-HttpOnly** - מונע XSS attacks
2. **תמיד השתמש ב-SameSite=Strict** - מונע CSRF attacks
3. **השתמש ב-Secure ב-HTTPS** - מונע interception
4. **הגבל Max-Age** - tokens קצרים יותר = אבטחה טובה יותר
5. **השתמש ב-CSRF tokens** - אם משתמשים ב-cookies

## Resources

- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [OWASP: Secure Cookie Flags](https://owasp.org/www-community/HttpOnly)
- [SameSite Cookies Explained](https://web.dev/samesite-cookies-explained/)
