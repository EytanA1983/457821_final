@echo off
REM Test Registration Auto-Flow
REM בדיקת תהליך רישום אוטומטי

echo ========================================
echo  Test Registration Auto-Flow
echo  בדיקת תהליך רישום אוטומטי
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
echo  Opening Registration Page...
echo  פותח דף רישום...
echo ========================================
echo.

REM Open registration page in default browser
start http://localhost:5173/register

echo.
echo ========================================
echo  Test Instructions:
echo  הוראות בדיקה:
echo ========================================
echo.
echo 1. Fill the form with:
echo    אימייל: test@example.com
echo    סיסמה: 123456
echo    אימות סיסמה: 123456
echo.
echo 2. Click "הירשם" (Register)
echo.
echo 3. Check:
echo    - Token saved in localStorage? (F12 -^> Application -^> Local Storage)
echo    - Redirected to /?
echo    - Rooms list displayed?
echo    - Toast success message?
echo.
echo 4. Open Console (F12) to see detailed logs:
echo    [RegisterPage] Sending registration request...
echo    [RegisterPage] Registration successful!
echo    [RegisterPage] Saving tokens to localStorage...
echo    [RegisterPage] Token saved successfully
echo    [RegisterPage] Redirecting to home page...
echo.
echo ========================================
echo  Expected Result:
echo  תוצאה מצופה:
echo ========================================
echo.
echo   [OK] Token saved: localStorage.getItem('token')
echo   [OK] Refresh token saved: localStorage.getItem('refresh_token')
echo   [OK] URL changed to: http://localhost:5173/
echo   [OK] Rooms list displayed
echo   [OK] Success message: "נרשמת בהצלחה!"
echo.
echo ========================================
echo  For detailed guide, see:
echo  למדריך מפורט, ראה:
echo ========================================
echo   REGISTRATION-AUTO-TEST.md
echo.
pause
