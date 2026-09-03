@echo off
REM ═══════════════════════════════════════════════════════════════
REM   הפעלת קונסולת המנהל — לחיצה כפולה (Windows)
REM ═══════════════════════════════════════════════════════════════
chcp 65001 >nul
setlocal
cd /d "%~dp0.."

echo 🛡️  קונסולת המנהל של RoomMate
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ❌ Node.js לא מותקן על המחשב הזה.
  echo    התקינו מ-https://nodejs.org ^(גרסה 18 ומעלה^) ונסו שוב.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo 📦 מתקין תלויות — זה קורה רק בפעם הראשונה...
  call npm install
  if errorlevel 1 (
    echo ❌ ההתקנה נכשלה. ראו את השגיאה למעלה.
    pause
    exit /b 1
  )
  echo.
)

if not exist admin\service-account.json (
  echo ⚠️  לא נמצא admin\service-account.json — הקונסולה תעלה במצב הדגמה
  echo    ^(נתוני דמה, לא הנתונים האמיתיים של האפליקציה^).
  echo.
  echo    כדי להתחבר לנתונים האמיתיים:
  echo    1. Firebase Console → ⚙️ הגדרות פרויקט → Service accounts
  echo       → Generate new private key
  echo    2. שמרו את הקובץ שירד בתור:
  echo       %CD%\admin\service-account.json
  echo    3. ודאו שיש קובץ .env.local בשורש הפרויקט עם השורה:
  echo       VITE_FB_DATABASE_URL=https://^<הפרויקט-שלכם^>.firebasedatabase.app
  echo       ^(אותו ערך שמוגדר כ-secret ב-GitHub עבור הפריסה^)
  echo.
  echo    ⚠️ הקובץ service-account.json הוא סוד אמיתי — לעולם לא לשתף,
  echo       להעלות ל-git, ל-Drive, ל-Slack, או להדביק בשיחה עם Claude.
  echo.
)

call npm run admin

echo.
pause
