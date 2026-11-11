@echo off
cd /d "%~dp0project-buildsmite"

start "" cmd /c "timeout /t 1 /nobreak >nul & start "" http://localhost:8000"
python -m http.server 8000