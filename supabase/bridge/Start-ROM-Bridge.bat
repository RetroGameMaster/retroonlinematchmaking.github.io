@echo off
setlocal
cd /d "%~dp0"

set "SYNC_SCRIPT=%~dp0rom_sqlite_sync.py"
set "ROM_SQLITE_PATH=%~dp0localdb.db"
set "ROM_BRIDGE_FUNCTION_URL=https://lapyxhothazalssrbimb.supabase.co/functions/v1/discord-lobby-bridge"
set "SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcHl4aG90aGF6YWxzc3JiaW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNjg0NDUsImV4cCI6MjA3Njk0NDQ0NX0.isfh75lAbJotctu6dkd_aAYK-2YNyYM4o-jqKFB5tVA"

if not exist "%SYNC_SCRIPT%" (
    echo ERROR: rom_sqlite_sync.py must be in the same folder as this file.
    pause
    exit /b 1
)

if not exist "%ROM_SQLITE_PATH%" (
    echo Could not find localdb.db beside this file.
    set /p "ROM_SQLITE_PATH=Enter the full path to the bot SQLite database: "
)

if not exist "%ROM_SQLITE_PATH%" (
    echo ERROR: Database file not found: "%ROM_SQLITE_PATH%"
    pause
    exit /b 1
)

where py >nul 2>nul
if not errorlevel 1 (
    set "PYTHON=py -3"
) else (
    where python >nul 2>nul
    if errorlevel 1 (
        echo ERROR: Python 3 is required. Install Python 3 and try again.
        pause
        exit /b 1
    )
    set "PYTHON=python"
)

echo.
echo Checking the database in read-only mode...
%PYTHON% "%SYNC_SCRIPT%" --dry-run
if errorlevel 1 (
    echo.
    echo ERROR: The database check failed. No data was sent to Supabase.
    pause
    exit /b 1
)

echo.
echo The bridge will ask for the bridge secret and anon/public API key if not already configured.
echo Do NOT enter the service_role key.
echo It will sync immediately and then repeat every 60 seconds.
echo Close this window or press Ctrl+C to stop syncing.
echo.
%PYTHON% "%SYNC_SCRIPT%"
if errorlevel 1 (
    echo.
    echo The bridge stopped after an error. See the message above.
    pause
)

endlocal
