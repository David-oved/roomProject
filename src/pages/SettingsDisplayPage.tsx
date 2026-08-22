import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { CheckIcon } from '../components/ui/icons';
import { useRoom } from '../store/RoomContext';
import { useTheme, type ThemePreference } from '../store/ThemeContext';

const OPTIONS: Array<{ value: ThemePreference; label: string; hint: string; icon: string }> = [
  { value: 'system', label: 'מערכת', hint: 'לפי הגדרת המכשיר', icon: '📱' },
  { value: 'light', label: 'בהיר', hint: 'רקע לבן, תמיד', icon: '☀️' },
  { value: 'dark', label: 'כהה', hint: 'נוח לעיניים בלילה', icon: '🌙' },
];

/**
 * מסך תצוגה — קביעת מצב בהיר/כהה/מערכת.
 *
 * ‼️ הבחירה נשמרת ב-localStorage ומוחלת מיידית (ThemeContext) — אין
 * "שמירה", כל לחיצה היא הבחירה בפועל, בדיוק כמו מתג הגדרות מערכת רגיל.
 */
export default function SettingsDisplayPage() {
  const { roomCode } = useRoom();
  const { preference, resolved, setPreference } = useTheme();

  return (
    <>
      <TopBar title="תצוגה" back={`/r/${roomCode}/settings`} />
      <PlainShell hasTopBar>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-2.5">
            {OPTIONS.map((opt) => {
              const selected = preference === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPreference(opt.value)}
                  aria-pressed={selected}
                  className={`tap-area relative flex flex-col items-center gap-1.5 rounded-2xl border
                              px-2 py-4 text-center transition active:scale-[.97] ${
                                selected
                                  ? 'border-brand-600 bg-brand-50 shadow-card'
                                  : 'border-ink-200 bg-surface hover:bg-ink-50'
                              }`}
                >
                  {selected && (
                    <span
                      aria-hidden
                      className="absolute end-2 top-2 grid h-5 w-5 place-items-center rounded-full
                                 bg-brand-700 text-white"
                    >
                      <CheckIcon width={12} height={12} strokeWidth={3} />
                    </span>
                  )}
                  <span aria-hidden className="text-2xl">
                    {opt.icon}
                  </span>
                  <span className={`text-sm font-bold ${selected ? 'text-brand-800' : 'text-ink-800'}`}>
                    {opt.label}
                  </span>
                  <span className="text-[11px] leading-tight text-ink-500">{opt.hint}</span>
                </button>
              );
            })}
          </div>

          {/* תצוגה מקדימה חיה — כרטיס דמה שנראה בדיוק כמו כרטיס אמיתי באפליקציה,
              כדי שאפשר יהיה לבדוק שהמצב הנבחר "נראה טוב" בלי לצאת מהמסך */}
          <div className="card space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-ink-900">תצוגה מקדימה</p>
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600">
                {resolved === 'dark' ? 'כהה' : 'בהיר'}
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-ink-200/70 bg-ink-50 p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-lg">
                🛒
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">חלב 3%</p>
                <p className="truncate text-xs text-ink-500">נוסף על ידי דנה · לפני 5 דקות</p>
              </div>
              <span className="shrink-0 rounded-full bg-brand-700 px-2.5 py-1 text-[11px] font-bold text-white">
                דחוף
              </span>
            </div>
            <p className="text-xs leading-relaxed text-ink-500">
              הבחירה חלה מיידית על כל האפליקציה. "מערכת" עוקבת אוטומטית אחרי הגדרת המכשיר —
              כולל שינוי אוטומטי בין יום ולילה, אם כך הוגדר בטלפון.
            </p>
          </div>
        </div>
      </PlainShell>
    </>
  );
}
