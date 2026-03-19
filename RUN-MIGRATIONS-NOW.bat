@echo off
chcp 65001 >nul
echo ================================================
echo   🗄️ Running Alembic Migrations
echo ================================================
echo.

REM Navigate to project root
cd /d "C:\Users\maore\git\סידור וארגון הבית - אלי מאור"

echo 📂 Current directory: %CD%
echo.

REM Navigate to backend
cd backend
echo 📂 Backend directory: %CD%
echo.

echo ▶️ Step 1: Check current migration status...
echo.
python -c "from alembic.config import Config; from alembic import command; cfg = Config('alembic.ini'); command.current(cfg)"
echo.

echo ▶️ Step 2: Check migration history...
echo.
python -c "from alembic.config import Config; from alembic import command; cfg = Config('alembic.ini'); command.history(cfg)"
echo.

echo ▶️ Step 3: Upgrade to head (apply all migrations)...
echo.
python -c "from alembic.config import Config; from alembic import command; cfg = Config('alembic.ini'); command.upgrade(cfg, 'head')"
echo.

echo ================================================
echo   ✅ Migrations Complete!
echo ================================================
echo.
echo 📊 Verify in database:
echo    - shopping_lists table
echo    - shopping_items table
echo    - room_id column in shopping_lists
echo.

pause
