@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_common.ps1" -InitLocalDb
exit /b %errorlevel%
