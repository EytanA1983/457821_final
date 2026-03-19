@echo off
REM Test Shopping Lists Feature
REM בדיקת תכונת רשימות קניות

echo ========================================
echo  Test Shopping Lists Feature
echo  בדיקת תכונת רשימות קניות
echo ========================================
echo.

echo Step 1: Check if servers are running...
echo.

REM Check if backend is running
curl -s http://localhost:8000/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Backend is running on http://localhost:8000
) else (
    echo [!] Backend is NOT running!
    echo.
    echo Starting backend...
    start "Backend Server" cmd /k "cd backend && uvicorn app.main:app --reload"
    timeout /t 5 >nul
)

echo.

REM Check if frontend is running
curl -s http://localhost:5173 >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Frontend is running on http://localhost:5173
) else (
    echo [!] Frontend is NOT running!
    echo.
    echo Starting frontend...
    start "Frontend Server" cmd /k "cd frontend && npm run dev"
    timeout /t 10 >nul
)

echo.
echo ========================================
echo  Opening Test Pages...
echo  פותח דפי בדיקה...
echo ========================================
echo.

REM Open Swagger UI
echo Opening Swagger UI...
start http://localhost:8000/docs

timeout /t 2 >nul

REM Open Shopping Lists page
echo Opening Shopping Lists page...
start http://localhost:5173/shopping

echo.
echo ========================================
echo  Test Instructions:
echo  הוראות בדיקה:
echo ========================================
echo.
echo Test 1: Swagger API
echo   1. Go to http://localhost:8000/docs
echo   2. Click "Authorize" and paste: Bearer ^<your_token^>
echo   3. Try GET /api/shopping
echo   4. Should return empty array: []
echo.
echo Test 2: Create List via UI
echo   1. Go to http://localhost:5173/shopping
echo   2. Click "צור רשימה חדשה"
echo   3. Fill form and submit
echo   4. Check Network tab: POST returns 201
echo   5. List should appear in UI
echo.
echo Test 3: "Use Previous List" Modal
echo   1. Go to http://localhost:5173/shopping
echo   2. Modal should popup automatically
echo   3. Try both buttons: "כן, השתמש" and "לא, צור חדשה"
echo.
echo Test 4: Add Fixed Item
echo   1. Open any shopping list
echo   2. Add item: "חלב"
echo   3. Check "🔁 קבוע" checkbox
echo   4. Click "הוסף"
echo   5. Item should display with 🔁 emoji
echo.
echo Test 5: Celery Reminders (Optional)
echo   1. Start Celery worker in new terminal:
echo      cd backend
echo      celery -A app.workers.celery_app.celery worker --loglevel=info
echo   2. Create list with reminder_time (5 min future)
echo   3. Wait and check Celery logs
echo.
echo Test 6: Room Integration
echo   1. Go to any room page
echo   2. Click "🛒 קנה בחדר"
echo   3. Should filter by room
echo   4. Create list - room should be pre-selected
echo.
echo ========================================
echo  Expected Results:
echo  תוצאות מצופות:
echo ========================================
echo.
echo   [OK] Swagger GET /api/shopping returns []
echo   [OK] Create list via UI - POST 201
echo   [OK] List appears in shopping lists page
echo   [OK] Modal "השתמש ברשימה הקודמת?" appears
echo   [OK] Fixed items show 🔁 emoji
echo   [OK] Celery task scheduled and executed
echo   [OK] Room filter works
echo.
echo ========================================
echo  For detailed guide, see:
echo  למדריך מפורט, ראה:
echo ========================================
echo   TEST-SHOPPING-LISTS.md
echo.
echo ========================================
echo  Optional: Start Celery Worker
echo  אופציונלי: הרץ Celery Worker
echo ========================================
echo   cd backend
echo   celery -A app.workers.celery_app.celery worker --loglevel=info
echo.
pause
