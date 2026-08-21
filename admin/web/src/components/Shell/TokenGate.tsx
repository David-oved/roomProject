import { useState } from 'react';
import { setToken } from '../../lib/api';

/**
 * מסך חסימה כשאין טוקן תקין.
 *
 * מופיע כשפותחים את הכתובת ידנית בלי הטוקן — ה-launcher (npm run admin)
 * פותח את הדפדפן עם הטוקן מוזרק, ולכן במסלול הרגיל המסך הזה לא נראה.
 */
export function TokenGate({ message }: { message: string }) {
  const [value, setValue] = useState('');

  return (
    <div className="gate">
      <div className="gate__card">
        <h1>🛡️ קונסולת המנהל</h1>
        <p>
          {message.includes('טוקן')
            ? 'נדרש טוקן הגישה המקומי. הוא מודפס בטרמינל שבו רץ השרת, ונמצא גם בקובץ admin/.data/token.'
            : `לא הצלחתי להתחבר לשרת המקומי: ${message}`}
        </p>
        <input
          className="input"
          placeholder="הדביקו כאן את הטוקן"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) {
              setToken(value);
              window.location.reload();
            }
          }}
        />
        <button
          className="btn primary block"
          style={{ marginTop: 12 }}
          disabled={!value.trim()}
          onClick={() => {
            setToken(value);
            window.location.reload();
          }}
        >
          כניסה
        </button>
        <p style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
          אם השרת אינו רץ: הריצו <span className="mono">npm run admin</span> בתיקיית הפרויקט.
        </p>
      </div>
    </div>
  );
}
