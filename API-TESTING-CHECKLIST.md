# 🧪 API Testing Checklist

רשימת בדיקות ל-API endpoints החשובים ל-production readiness.

## 🔍 Health & Status Endpoints

### Basic Health Check
```bash
GET /health
```
**Expected:** `200 OK` with `{"status": "healthy", "timestamp": "...", "uptime_seconds": ...}`

### Liveness Probe
```bash
GET /live
```
**Expected:** `200 OK` - App is alive

### Readiness Probe
```bash
GET /ready
```
**Expected:** `200 OK` if DB/Redis are healthy, `503` if not ready

### Detailed Health
```bash
GET /health/detailed
```
**Expected:** `200 OK` with detailed component status (DB, Redis, etc.)

---

## 🔐 Authentication Endpoints

### Register
```bash
POST /api/auth/register
Body: {"email": "test@example.com", "password": "secure123"}
```
**Expected:** `201 Created` with `{"access_token": "...", "refresh_token": "..."}`

### Login
```bash
POST /api/auth/login
Body: {"email": "test@example.com", "password": "secure123"}
```
**Expected:** `200 OK` with tokens

### Get Current User
```bash
GET /api/auth/me
Headers: Authorization: Bearer <access_token>
```
**Expected:** `200 OK` with user data

---

## 🏠 Core API Endpoints (Blueprint)

### Daily Reset
```bash
GET /api/daily-reset
Headers: Authorization: Bearer <token>
```
**Expected:** `200 OK` with daily focus task

```bash
POST /api/daily-reset/complete
Headers: Authorization: Bearer <token>
Body: {"task_id": 1} (optional)
```
**Expected:** `200 OK` with updated daily focus

```bash
POST /api/daily-reset/refresh
Headers: Authorization: Bearer <token>
Body: {"preferred_room_id": 1} (optional)
```
**Expected:** `200 OK` with new daily focus

### Progress
```bash
GET /api/progress?range=week
Headers: Authorization: Bearer <token>
```
**Expected:** `200 OK` with `{"completed_tasks": 12, "organized_rooms": 3, "donated_items": 0}`

### AI Coach Suggestion
```bash
GET /api/coach/suggestion?room_id=1
Headers: Authorization: Bearer <token>
```
**Expected:** `200 OK` with `{"task_title": "...", "tip": "...", "source": "ai|fallback"}`

---

## 📋 Tasks Endpoints

### List Tasks
```bash
GET /api/tasks?completed=false&room_id=1
Headers: Authorization: Bearer <token>
```
**Expected:** `200 OK` with array of tasks

### Create Task
```bash
POST /api/tasks
Headers: Authorization: Bearer <token>
Body: {"title": "Test task", "room_id": 1}
```
**Expected:** `201 Created` with task data

### Update Task
```bash
PATCH /api/tasks/{id}
Headers: Authorization: Bearer <token>
Body: {"completed": true}
```
**Expected:** `200 OK` with updated task

### Delete Task
```bash
DELETE /api/tasks/{id}
Headers: Authorization: Bearer <token>
```
**Expected:** `204 No Content`

---

## 🏡 Rooms Endpoints

### List Rooms
```bash
GET /api/rooms
Headers: Authorization: Bearer <token>
```
**Expected:** `200 OK` with array of rooms

### Create Room
```bash
POST /api/rooms
Headers: Authorization: Bearer <token>
Body: {"name": "Test Room"}
```
**Expected:** `201 Created` with room data

### Delete Room
```bash
DELETE /api/rooms/{id}
Headers: Authorization: Bearer <token>
```
**Expected:** `204 No Content`

---

## 📊 Testing Script

### Quick Test (using curl)

```bash
# 1. Health check (no auth needed)
curl http://localhost:8000/health

# 2. Register user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123456"}'

# 3. Login
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123456"}' \
  | jq -r '.access_token')

# 4. Test protected endpoints
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:8000/api/daily-reset \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:8000/api/progress \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:8000/api/coach/suggestion \
  -H "Authorization: Bearer $TOKEN"
```

---

## ✅ Production Readiness Checklist

Before deploying, verify:

- [ ] `/health` returns 200
- [ ] `/ready` returns 200 (DB connected)
- [ ] `/api/auth/register` creates users
- [ ] `/api/auth/login` returns tokens
- [ ] `/api/auth/me` works with token
- [ ] `/api/daily-reset` returns task
- [ ] `/api/progress` returns stats
- [ ] `/api/coach/suggestion` returns suggestion
- [ ] `/api/tasks` CRUD operations work
- [ ] `/api/rooms` CRUD operations work
- [ ] Error responses are properly formatted
- [ ] Rate limiting works (test with many requests)
- [ ] CORS headers are present

---

## 🐛 Common Issues

### 401 Unauthorized
- Check token is valid and not expired
- Verify `Authorization: Bearer <token>` header format

### 500 Internal Server Error
- Check backend logs
- Verify database connection
- Check environment variables

### 503 Service Unavailable
- Check `/ready` endpoint
- Verify database is running
- Check Redis connection (if using)

---

## 📝 Notes

- All endpoints require authentication except `/health`, `/live`, `/ready`
- Token expires after 15 minutes (default)
- Use refresh token to get new access token
- Rate limiting: 60 requests/minute (default)
