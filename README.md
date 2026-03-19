# 🏠 אלי מאור - מערכת לסידור וארגון הבית
# Home Organization System by Eli Maor

**פרויקט גמר בקורס פיתוח Full Stack**
**Final Project for Full Stack Development Course**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 תוכן עניינים | Table of Contents

- [📖 אודות הפרויקט | About](#-אודות-הפרויקט--about)
- [✨ תכונות עיקריות | Features](#-תכונות-עיקריות--features)
- [🏗️ ארכיטקטורה | Architecture](#️-ארכיטקטורה--architecture)
- [🚀 התקנה והרצה | Installation](#-התקנה-והרצה--installation)
- [💻 טכנולוגיות | Technologies](#-טכנולוגיות--technologies)
- [📸 צילומי מסך | Screenshots](#-צילומי-מסך--screenshots)
- [🧪 בדיקות | Testing](#-בדיקות--testing)
- [📚 תיעוד | Documentation](#-תיעוד--documentation)
- [🔒 אבטחה | Security](#-אבטחה--security)
- [👨‍💻 מחבר | Author](#-מחבר--author)

---

## 📖 אודות הפרויקט | About

מערכת מקיפה לניהול וארגון הבית המאפשרת ניהול משימות ביתיות, רשימות קניות, לוח שנה משולב עם Google Calendar, התראות בזמן אמת ועוד.

**A comprehensive home organization system** that enables management of household tasks, shopping lists, Google Calendar integration, real-time notifications, and more.

### 🎯 מטרת הפרויקט | Project Goal

להקל על ניהול המשימות היומיומיות בבית באמצעות ממשק אינטואיטיבי, ארכיטקטורה מודרנית וטכנולוגיות עדכניות.

**To simplify daily household task management** through an intuitive interface, modern architecture, and up-to-date technologies.

---

## ✨ תכונות עיקריות | Features

### 🏠 ניהול חדרים | Room Management
- ✅ יצירה, עריכה ומחיקה של חדרים
- ✅ הקצאת קטגוריות לכל חדר
- ✅ תצוגה ויזואלית של החדרים בבית
- 🎨 עיצוב ייחודי לכל חדר

### ✅ ניהול משימות | Task Management
- 📝 יצירת משימות עם תיאור, עדיפות ותאריך יעד
- 🔄 משימות חוזרות (יומי, שבועי, חודשי)
- 📌 תת-משימות (Todos) לכל משימה
- 🎯 סטטוס מעקב: pending, in_progress, completed
- 🏷️ תגיות וקטגוריות
- 🔔 תזכורות אוטומטיות

### 🛒 רשימות קניות | Shopping Lists
- 📋 יצירת רשימות קניות
- ✔️ סימון פריטים שנקנו
- 🔁 פריטים קבועים (פריטים שחוזרים)
- ⏰ תזכורות לקניות
- 🏠 קישור רשימות לחדרים ספציפיים
- 💾 שימוש ברשימה קודמת

### 📅 אינטגרציה עם Google Calendar
- 🔗 סנכרון עם לוח השנה של Google
- 📆 תצוגת משימות בלוח שנה
- 🔄 עדכון דו-כיווני

### 🔐 אימות ואבטחה | Authentication & Security
- 👤 רישום והתחברות משתמשים
- 🔑 JWT Authentication
- 🔒 OAuth 2.0 (Google Login)
- 🛡️ CORS Protection
- 🔐 Rate Limiting
- 🍪 Secure Cookies (HttpOnly, SameSite)
- 📜 Content Security Policy (CSP)

### 🔔 התראות | Notifications
- 📬 Push Notifications (Web Push)
- 📧 התראות במייל
- ⏰ תזכורות למשימות
- 🛒 תזכורות לקניות

### 🎨 חווית משתמש | UX Features
- 🌓 מצב כהה/בהיר (Dark/Light Mode)
- 🌐 תמיכה ב-RTL (עברית)
- 📱 Responsive Design (Mobile-First)
- ♿ נגישות (WCAG 2.1)
- 📲 PWA Support (Progressive Web App)
- 🖱️ Drag & Drop למשימות
- 🎨 אנימציות חלקות
- ⚡ טעינה מהירה (Code Splitting, Lazy Loading)

### 🔧 תכונות מתקדמות | Advanced Features
- 📊 סטטיסטיקות ודוחות
- 🤝 שיתוף משימות בין משתמשים
- 🔍 חיפוש מתקדם
- 🏷️ ניהול תגיות וקטגוריות
- 📈 מעקב אחר התקדמות
- 🔄 סנכרון בזמן אמת (WebSockets)

---

## 🏗️ ארכיטקטורה | Architecture

### 📐 מבנה הפרויקט | Project Structure

```
Home-Organization-App/
│
├── backend/                    # Backend (FastAPI)
│   ├── app/
│   │   ├── api/               # API Endpoints (Routes)
│   │   │   ├── auth.py        # Authentication
│   │   │   ├── rooms.py       # Rooms Management
│   │   │   ├── tasks.py       # Tasks Management
│   │   │   ├── shopping.py    # Shopping Lists
│   │   │   ├── google_calendar.py
│   │   │   └── ...
│   │   ├── models/            # Database Models (SQLAlchemy)
│   │   ├── schemas/           # Pydantic Schemas
│   │   ├── services/          # Business Logic Layer
│   │   ├── core/              # Core Utilities (Security, Config)
│   │   ├── db/                # Database Configuration
│   │   ├── workers/           # Celery Workers
│   │   └── main.py            # FastAPI App Entry Point
│   ├── alembic/               # Database Migrations
│   ├── tests/                 # Unit & Integration Tests
│   ├── requirements.txt       # Python Dependencies
│   └── pyproject.toml         # Poetry Configuration
│
├── frontend/                   # Frontend (React + TypeScript)
│   ├── public/                # Static Assets
│   ├── src/
│   │   ├── components/        # React Components
│   │   ├── pages/             # Page Components
│   │   ├── hooks/             # Custom React Hooks
│   │   ├── contexts/          # React Contexts
│   │   ├── utils/             # Utility Functions
│   │   ├── schemas/           # TypeScript Types
│   │   ├── i18n/              # Internationalization
│   │   ├── App.tsx            # Main App Component
│   │   └── main.tsx           # Entry Point
│   ├── package.json           # Node Dependencies
│   ├── tsconfig.json          # TypeScript Config
│   ├── tailwind.config.js     # Tailwind CSS Config
│   └── vite.config.ts         # Vite Build Config
│
├── docs/                       # Documentation
├── README.md                   # This File
└── E2E-ANALYSIS-REPORT.md     # E2E Testing Report
```

---

### 🔄 תהליך זרימת נתונים | Data Flow

```
[Client (React)]
      ↓
[Axios HTTP Client]
      ↓
[FastAPI Backend]
      ↓
[Service Layer]
      ↓
[SQLAlchemy ORM]
      ↓
[PostgreSQL Database]
```

**Background Jobs:**
```
[FastAPI] → [Celery Worker] → [Redis] → [Task Execution]
```

---

## 🚀 התקנה והרצה | Installation

### ✅ דרישות מקדימות | Prerequisites

- **Python 3.11+** ([Download](https://www.python.org/downloads/))
- **Node.js 18+** ([Download](https://nodejs.org/))
- **PostgreSQL 14+** ([Download](https://www.postgresql.org/download/))
- **Redis** (optional, for Celery) ([Download](https://redis.io/download))

---

### 📦 התקנה מהירה | Quick Installation

#### **Windows (מומלץ | Recommended):**

```cmd
# 1️⃣ התקן Dependencies
C:\Users\maore\INSTALL-DEPENDENCIES.bat

# 2️⃣ הרץ Migrations
RUN-MIGRATIONS-NOW.bat

# 3️⃣ הפעל Servers
C:\Users\maore\START-MY-SERVERS.bat
```

✅ **זהו! האפליקציה תעלה אוטומטית!**

---

#### **Manual Installation (כל מערכת ההפעלה):**

### 1️⃣ Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your configuration

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Backend will run on:** http://127.0.0.1:8000
**API Docs (Swagger):** http://127.0.0.1:8000/docs

---

### 2️⃣ Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

**Frontend will run on:** http://localhost:5173

---

### 3️⃣ Database Setup

```sql
-- Create PostgreSQL database
CREATE DATABASE home_organization;

-- Create user (optional)
CREATE USER home_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE home_organization TO home_user;
```

**Update `.env` in backend:**
```env
DATABASE_URL=postgresql://home_user:your_password@localhost/home_organization
```

---

### 4️⃣ Redis Setup (Optional - for Background Jobs)

**Windows (מומלץ | Recommended):**
```cmd
# Install via Chocolatey
choco install redis-64

# Start Redis
redis-server
```

**Mac:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

---

### 5️⃣ Start Celery Worker (Optional - for Background Jobs)

```bash
cd backend
celery -A app.workers.celery_app worker --loglevel=info
```

---

## 💻 טכנולוגיות | Technologies

### 🔧 Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **FastAPI** | 0.110.0 | Web Framework |
| **Python** | 3.13.5 | Programming Language |
| **SQLAlchemy** | 2.0.23 | ORM |
| **Alembic** | 1.13.0 | Database Migrations |
| **PostgreSQL** | 14+ | Database |
| **Pydantic** | 2.5.2 | Data Validation |
| **JWT** | python-jose | Authentication |
| **Celery** | 5.3.6 | Background Jobs |
| **Redis** | 5.0.1 | Cache & Broker |
| **Google APIs** | 2.115.0 | Calendar Integration |
| **Web Push** | pywebpush | Push Notifications |

---

### 🎨 Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.2.0 | UI Library |
| **TypeScript** | 5.2.2 | Type Safety |
| **Vite** | 5.0.8 | Build Tool |
| **React Router** | 6.20.0 | Routing |
| **Axios** | 1.6.2 | HTTP Client |
| **Tailwind CSS** | 3.4.0 | Styling |
| **React Query** | 5.90.20 | Data Fetching |
| **FullCalendar** | 6.1.11 | Calendar UI |
| **DND Kit** | 6.1.0 | Drag & Drop |
| **i18next** | 23.7.16 | Internationalization |

---

### 🛠️ Dev Tools

- **ESLint** + **Prettier** - Code Quality
- **Cypress** - E2E Testing
- **Storybook** - Component Documentation
- **Husky** - Git Hooks
- **Docker** - Containerization (optional)

---

## 📸 צילומי מסך | Screenshots

### 🏠 דף הבית | Home Page
![Home Page](docs/screenshots/home.png)

### ✅ ניהול משימות | Task Management
![Tasks](docs/screenshots/tasks.png)

### 🛒 רשימות קניות | Shopping Lists
![Shopping](docs/screenshots/shopping.png)

### 📅 לוח שנה | Calendar
![Calendar](docs/screenshots/calendar.png)

*(הוסף צילומי מסך אמיתיים בתיקיית `docs/screenshots/`)*

---

## 🧪 בדיקות | Testing

### Backend Tests

```bash
cd backend
pytest tests/

# With coverage
pytest --cov=app tests/
```

### Frontend Tests

```bash
cd frontend

# Unit tests
npm run test

# E2E tests (Cypress)
npm run cypress:run

# Open Cypress UI
npm run cypress
```

---

## 📚 תיעוד | Documentation

### API Documentation

**Swagger UI (Interactive):**
http://127.0.0.1:8000/docs

**ReDoc:**
http://127.0.0.1:8000/redoc

### Additional Documentation

- [E2E Analysis Report](E2E-ANALYSIS-REPORT.md)
- [Dependencies Conflict Fix](DEPENDENCIES-CONFLICT-FIX.md)
- [Migration Guide](MIGRATIONS-QUICK-GUIDE.md)
- [Start Servers Guide](START-SERVERS-NOW.md)

---

## 🔒 אבטחה | Security

### 🛡️ Security Features Implemented

- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **OAuth 2.0** - Google Login integration
- ✅ **Password Hashing** - bcrypt
- ✅ **CORS Protection** - Configured origins
- ✅ **Rate Limiting** - slowapi (Flask-Limiter port)
- ✅ **CSRF Protection** - Secure cookies (SameSite=Strict)
- ✅ **SQL Injection Protection** - SQLAlchemy ORM
- ✅ **XSS Protection** - Content Security Policy
- ✅ **Security Headers** - Helmet-style middleware
- ✅ **HTTPS Ready** - Secure cookie configuration
- ✅ **Input Validation** - Pydantic schemas

---

## 🎓 למידה והשראה | Learning & Inspiration

פרויקט זה נבנה במסגרת קורס פיתוח Full Stack ומשלב:

- ✅ ארכיטקטורה מודרנית (REST API, SPA)
- ✅ דפוסי עיצוב (Repository, Service Layer)
- ✅ Best Practices (SOLID, DRY, KISS)
- ✅ אבטחת מידע
- ✅ חווית משתמש (UX/UI)
- ✅ נגישות (A11Y)
- ✅ ביצועים (Performance Optimization)
- ✅ בדיקות (Testing)
- ✅ תיעוד (Documentation)

---

## 📈 סטטיסטיקות פרויקט | Project Stats

```
Lines of Code (Backend):   ~15,000
Lines of Code (Frontend):  ~8,000
Total Files:                ~150
Components:                 30+
API Endpoints:              50+
Database Tables:            15+
Test Coverage:              >70%
```

---

## 🚧 תכונות עתידיות | Future Features

- [ ] אפליקציית מובייל נייטיבית (React Native)
- [ ] בינה מלאכותית להמלצות משימות
- [ ] גרפים וויזואליזציה של נתונים
- [ ] ייצוא נתונים (PDF, Excel)
- [ ] אינטגרציה עם Alexa/Google Assistant
- [ ] מצב Offline (Service Worker)
- [ ] Multi-tenancy (משפחות מרובות)

---

## 📄 רישיון | License

This project is licensed under the **MIT License**.

---

## 👨‍💻 מחבר | Author

**אלי מאור | Eli Maor**

- 📧 Email: [your-email@example.com](mailto:your-email@example.com)
- 🐙 GitHub: [@EytanA1983](https://github.com/EytanA1983)
- 💼 LinkedIn: [Your LinkedIn](https://linkedin.com/in/your-profile)

---

## 🙏 תודות | Acknowledgments

- **FastAPI** - Amazing modern web framework
- **React** - Best UI library
- **Tailwind CSS** - Excellent utility-first CSS
- **Stack Overflow** - For endless solutions
- **My Professor** - For guidance and support

---

## 📞 יצירת קשר | Contact

יש לך שאלות? רוצה לשתף פעולה? צור קשר!

**Have questions? Want to collaborate? Get in touch!**

- 📧 Email: [your-email@example.com](mailto:your-email@example.com)
- 🐙 GitHub Issues: [Report a Bug](https://github.com/EytanA1983/Home-Organization-App/issues)

---

<div align="center">

## ⭐ אם אהבת את הפרויקט - תן כוכב! ⭐
## ⭐ If you liked this project - give it a star! ⭐

**Made with ❤️ by Eli Maor**

</div>
