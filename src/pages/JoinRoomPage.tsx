import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { CopyIcon } from '../components/ui/icons';
import { requestToJoin } from '../services/roomService';
import { useAuth } from '../store/AuthContext';
import { useConnection } from '../store/ConnectionContext';
import { CODE_LENGTH, isValidRoomCode, sanitizeRoomCode } from '../lib/roomCode';

export default function JoinRoomPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, profile } = useAuth();
  const { isOnline } = useConnection();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [canPaste, setCanPaste] = useState(false);

  /** קודים שכבר ניסינו — מונע לולאת שליחה אוטומטית על קוד שנכשל */
  const attempted = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(
    async (value: string) => {
      if (!user || !profile || busy) return;
      if (!isValidRoomCode(value)) return;

      attempted.current.add(value);
      setError('');
      setBusy(true);
      try {
        await requestToJoin(value, user.uid, profile);
        navigate(`/rooms/${value}/pending`, { replace: true });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [user, profile, busy, navigate]
  );

  // קישור שיתוף: .../#/rooms/join?code=ABC123
  useEffect(() => {
    const fromUrl = params.get('code');
    if (fromUrl) setCode(sanitizeRoomCode(fromUrl));
  }, [params]);

  // הדבקה זמינה רק בהקשר מאובטח ובדפדפנים שתומכים
  useEffect(() => {
    setCanPaste(typeof navigator.clipboard?.readText === 'function' && window.isSecureContext);
    inputRef.current?.focus();
  }, []);

  /**
   * שליחה אוטומטית ברגע שהקוד מלא — כמו שדה קוד חד-פעמי.
   * הקוד באורך קבוע, ולכן אין שום מידע נוסף שהמשתמש יכול להוסיף:
   * הלחיצה על הכפתור היא צעד מיותר.
   */
  useEffect(() => {
    if (isValidRoomCode(code) && !attempted.current.has(code) && isOnline && !busy) {
      const t = window.setTimeout(() => void submit(code), 350);
      return () => window.clearTimeout(t);
    }
  }, [code, isOnline, busy, submit]);

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const clean = sanitizeRoomCode(text);
      if (clean.length === 0) {
        setError('לא נמצא קוד תקין בלוח ההעתקה');
        return;
      }
      setError('');
      setCode(clean);
    } catch {
      setError('לא הצלחנו לגשת ללוח ההעתקה. הדביקו ידנית בשדה.');
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(code);
  }

  return (
    <>
      <TopBar title="הצטרפות לחדר" back="/onboarding" />
      <PlainShell>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col py-6" noValidate>
          <div className="text-center">
            <div aria-hidden className="text-5xl">
              🔑
            </div>
            <h2 className="mt-3 text-lg font-bold text-ink-900">הזינו את קוד החדר</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              קוד בן <span className="num">{CODE_LENGTH}</span> תווים שקיבלתם מהשותפים
            </p>
          </div>

          <div className="mt-7">
            <label htmlFor="room-code" className="sr-only">
              קוד חדר בן {CODE_LENGTH} תווים
            </label>
            <input
              ref={inputRef}
              id="room-code"
              value={code}
              onChange={(e) => {
                setCode(sanitizeRoomCode(e.target.value));
                setError('');
              }}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="one-time-code"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              maxLength={CODE_LENGTH}
              placeholder="ABC123"
              aria-invalid={!!error}
              disabled={busy}
              className="w-full rounded-2xl border-2 border-ink-200 bg-white py-5 text-center
                         font-mono text-3xl tracking-[0.35em] text-ink-900 placeholder:text-ink-300
                         transition-colors focus:border-brand-500 focus:outline-none
                         focus:ring-4 focus:ring-brand-500/20 disabled:bg-ink-50"
              style={{ direction: 'ltr' }}
            />

            {/* חיווי התקדמות — ברור יותר ממונה תווים */}
            <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
              {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-6 rounded-full transition-colors ${
                    i < code.length ? 'bg-brand-600' : 'bg-ink-200'
                  }`}
                />
              ))}
            </div>

            {canPaste && code.length === 0 && (
              <button
                type="button"
                onClick={pasteFromClipboard}
                className="tap mx-auto mt-4 flex items-center gap-2 rounded-xl border
                           border-ink-200 bg-white px-4 text-sm font-semibold text-ink-700
                           transition active:scale-95 hover:bg-ink-50"
              >
                <CopyIcon width={17} height={17} />
                הדבקת קוד מהלוח
              </button>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl bg-rose-50 px-3 py-2.5 text-center text-sm text-rose-700"
            >
              {error}
            </p>
          )}

          <div className="mt-6 rounded-xl bg-ink-100/70 px-3.5 py-3 text-xs leading-relaxed text-ink-600">
            אחרי השליחה, מנהל החדר יקבל התראה ויאשר את הבקשה. תקבלו הודעה ברגע שתאושרו.
          </div>

          <div className="flex-1" />

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={busy}
            disabled={!isValidRoomCode(code) || !isOnline}
            className="mt-6"
          >
            {busy ? 'שולח…' : 'שליחת בקשת הצטרפות'}
          </Button>
        </form>
      </PlainShell>
    </>
  );
}
