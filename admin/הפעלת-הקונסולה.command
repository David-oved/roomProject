#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  הפעלת קונסולת המנהל — לחיצה כפולה (macOS)
# ═══════════════════════════════════════════════════════════════
#  קובץ .command: לחיצה כפולה עליו ב-Finder פותחת חלון Terminal
#  ומריצה אותו כסקריפט. לא צריך שום דבר נוסף כדי "להפעיל" אותו —
#  רק שהוא יהיה בר-ביצוע (git שומר את זה; ראו admin/README.md).
#
#  ‼️ בפעם הראשונה ש-macOS מריץ קובץ .command שהגיע מ-git clone הוא
#     עלול להתריע "לא ניתן לוודא את המפתח" (Gatekeeper). זה תקין —
#     Finder → קליק ימני על הקובץ → פתיחה → אישור, פעם אחת בלבד.
# ═══════════════════════════════════════════════════════════════

set -u
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR" || exit 1

echo "🛡️  קונסולת המנהל של RoomMate"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js לא מותקן על המחשב הזה."
  echo "   התקינו מ-https://nodejs.org (גרסה 18 ומעלה) ונסו שוב."
  echo ""
  read -n 1 -s -r -p "לחצו על מקש כלשהו לסגירת החלון..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "📦 מתקין תלויות — זה קורה רק בפעם הראשונה..."
  npm install || {
    echo "❌ ההתקנה נכשלה. ראו את השגיאה למעלה."
    read -n 1 -s -r -p "לחצו על מקש כלשהו לסגירת החלון..."
    exit 1
  }
  echo ""
fi

if [ ! -f admin/service-account.json ]; then
  echo "⚠️  לא נמצא admin/service-account.json — הקונסולה תעלה במצב הדגמה"
  echo "   (נתוני דמה, לא הנתונים האמיתיים של האפליקציה)."
  echo ""
  echo "   כדי להתחבר לנתונים האמיתיים:"
  echo "   1. Firebase Console → ⚙️ הגדרות פרויקט → Service accounts"
  echo "      → Generate new private key"
  echo "   2. שמרו את הקובץ שירד בתור:"
  echo "      $DIR/admin/service-account.json"
  echo "   3. ודאו שיש קובץ .env.local בשורש הפרויקט עם השורה:"
  echo "      VITE_FB_DATABASE_URL=https://<הפרויקט-שלכם>.firebasedatabase.app"
  echo "      (אותו ערך שמוגדר כ-secret ב-GitHub עבור הפריסה)"
  echo ""
  echo "   ⚠️ הקובץ service-account.json הוא סוד אמיתי — לעולם לא לשתף,"
  echo "      להעלות ל-git, ל-Drive, ל-Slack, או להדביק בשיחה עם Claude."
  echo ""
fi

npm run admin

echo ""
read -n 1 -s -r -p "הקונסולה נסגרה. לחצו על מקש כלשהו לסגירת החלון..."
