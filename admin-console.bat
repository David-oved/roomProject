@echo off
chcp 65001 >nul
cd /d %~dp0
echo מפעיל את קונסולת המנהל...
echo (השאירו את החלון הזה פתוח כל עוד אתם משתמשים בקונסולה)
echo.
call npm run admin
echo.
echo הקונסולה נסגרה.
pause
