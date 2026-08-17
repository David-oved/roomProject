import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
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

  // תמיכה בקישור שיתוף: /rooms/join?code=ABC123
  useEffect(() => {
    const fromUrl = params.get('code');
    if (fromUrl) setCode(sanitizeRoomCode(fromUrl));
  }, [params]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setError('');
    setBusy(true);
    try {
      await requestToJoin(code, user.uid, profile);
      navigate(`/rooms/${code}/pending`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
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
              קוד בן {CODE_LENGTH} תווים שקיבלתם מהשותפים לחדר
            </p>
          </div>

          <div className="mt-7">
            <label htmlFor="room-code" className="sr-only">
              קוד חדר בן {CODE_LENGTH} תווים
            </label>
            <input
              id="room-code"
              value={code}
              onChange={(e) => {
                setCode(sanitizeRoomCode(e.target.value));
                setError('');
              }}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={CODE_LENGTH}
              placeholder="ABC123"
              aria-invalid={!!error}
              className="w-full rounded-2xl border-2 border-ink-200 bg-white py-5 text-center
                         font-mono text-3xl tracking-[0.35em] text-ink-900 placeholder:text-ink-300
                         focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20"
              style={{ direction: 'ltr' }}
            />

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
            שליחת בקשת הצטרפות
          </Button>
        </form>
      </PlainShell>
    </>
  );
}
