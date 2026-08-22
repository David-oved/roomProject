import { useState } from 'react';
import { exchangeToken } from '../../lib/api';

/**
 * מסך הכניסה/הנעילה.
 *
 * מופיע בשלושה מצבים: הסשן פג (חוסר פעילות או תום הזמן), נעילה
 * מפורשת מהכפתור בסרגל, או פתיחה ידנית של הכתובת בלי לעבור במשגר.
 *
 * ‼️ המסלול הרגיל הוא הקיצור „קונסולת המנהל” — הוא פודה כרטיס חד-פעמי
 *    ופותח סשן. הדבקת הטוקן כאן היא **שחזור**, ומה שנשמר בסופה הוא
 *    סשן קצוב ולא הטוקן עצמו.
 */
export function AccessGate({ message }: { message: string }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);

  const expired = message.includes('פג') || message.includes('אישור') || message.includes('נדרש');

  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await exchangeToken(value);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ההתחברות נכשלה');
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <div className="gate__card">
        <h1>🔒 קונסולת המנהל נעולה</h1>
        <p>
          {expired
            ? 'הסשן הסתיים. הפעילו שוב את הקיצור „קונסולת המנהל” שעל שולחן העבודה — הוא פותח סשן חדש.'
            : `לא הצלחתי להתחבר לשרת המקומי: ${message}`}
        </p>

        {!showRecovery ? (
          <button className="btn block" onClick={() => setShowRecovery(true)}>
            כניסה עם טוקן שחזור
          </button>
        ) : (
          <>
            <p style={{ fontSize: 12, marginBottom: 8 }}>
              הטוקן נמצא בקובץ <span className="mono">admin/.data/token</span> (או בתיקייה
              שהוגדרה ב-<span className="mono">ADMIN_DATA_DIR</span>). השרת מדפיס את הנתיב
              אליו בעלייה, לא את הערך עצמו.
            </p>
            <input
              className="input"
              type="password"
              autoFocus
              placeholder="הדביקו כאן את טוקן השחזור"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
            />
            {error && (
              <p style={{ color: 'var(--danger, #e5484d)', fontSize: 13, marginBottom: 0 }}>{error}</p>
            )}
            <button
              className="btn primary block"
              style={{ marginTop: 12 }}
              disabled={!value.trim() || busy}
              onClick={() => void submit()}
            >
              {busy ? 'מתחבר…' : 'כניסה'}
            </button>
          </>
        )}

        <p style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
          אם השרת אינו רץ: לחצו על הקיצור, או הריצו{' '}
          <span className="mono">npm run admin</span> בתיקיית הפרויקט.
        </p>
      </div>
    </div>
  );
}
