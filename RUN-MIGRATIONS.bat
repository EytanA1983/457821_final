@echo off
REM Run Alembic Migrations - Simple Batch Script
echo ================================
echo Running Alembic Migrations
echo ================================
echo.

cd backend

echo Step 1: Check current migration status
echo Running: alembic current
alembic current
echo.

echo Step 2: Show available migrations
echo Running: alembic history
alembic history
echo.

echo Step 3: Upgrade to latest migration (head)
echo Running: alembic upgrade head
alembic upgrade head
echo.

if %errorlevel% equ 0 (
    echo ================================
    echo Migrations completed successfully!
    echo ================================
    echo.
    echo Database schema updated with:
    echo   - shopping_lists table
    echo   - shopping_items table
    echo   - room_id column in shopping_lists
) else (
    echo ================================
    echo Migration failed!
    echo ================================
    echo Please check the error messages above.
)

echo.
pause

cd ..
