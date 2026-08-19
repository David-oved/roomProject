import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { AppLogo } from '../components/layout/AppLogo';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { CameraIcon } from '../components/ui/icons';
import { Input, PasswordInput } from '../components/ui/Input';
import { authErrorCode, authErrorMessage, register } from '../services/authService';
import { uploadAvatar } from '../services/avatarService';
import { useConnection } from '../store/ConnectionContext';
import { setLastEmail } from '../lib/prefs';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { isOnline } = useConnection();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [busy, setBusy] = useState(false);

  /** לא null אחרי הרשמה מוצלחת — עוברים למסך "בחרו תמונת פרופיל" */
  const [newUid, setNewUid] = useState<string | null>(null);

  const nameError = name.length > 0 && name.trim().length < 2 ? 'השם קצר מדי' : undefined;
  const passError =
    password.length > 0 && password.length < 6 ? 'לפחות 6 תווים' : undefined;
  const confirmError =
    confirm.length > 0 && confirm !== password ? 'הסיסמאות אינן תואמות' : undefined;

  const canSubmit =
    name.trim().length >= 2 &&
    email.includes('@') &&
    password.length >= 6 &&
    password === confirm &&
    isOnline;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setErrorCode('');
    setBusy(true);
    try {
      const user = await register(email, password, name);
      setLastEmail(email);
      setNewUid(user.uid);
    } catch (err) {
      setError(authErrorMessage(err));
      setErrorCode(authErrorCode(err));
    } finally {
      setBusy(false);
    }
  }

  if (newUid) {
    return <AvatarPromptStep uid={newUid} name={name} onDone={() => navigate('/onboarding', { replace: true })} />;
  }

  return (
    <PlainShell>
      <div className="flex flex-1 flex-col justify-center py-6">
        <AppLogo showVersion={false} />

        <h1 className="mt-7 text-2xl font-bold text-ink-900">יצירת חשבון</h1>
        <p className="mt-1 text-sm text-ink-500">כמה פרטים ואפשר להתחיל</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
          <Input
            label="שם מלא"
            autoComplete="name"
            placeholder="דנה לוי"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={nameError}
            hint="כך החברים בחדר יראו אתכם"
            required
          />

          <Input
            label="אימייל"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            className="text-start"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <PasswordInput
            label="סיסמה"
            autoComplete="new-password"
            placeholder="לפחות 6 תווים"
            enterKeyHint="next"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passError}
            required
          />

          <PasswordInput
            label="אימות סיסמה"
            autoComplete="new-password"
            placeholder="שוב, בבקשה"
            enterKeyHint="go"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={confirmError}
            required
          />

          {error && (
            <div role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <p>{error}</p>

              {/*
                אימייל תפוס הוא מבוי סתום אם לא מציעים המשך: המשתמש לא
                יודע אם יש לו חשבון, אם שכח סיסמה, או שהאימייל שייך
                לחשבון שנוצר בדרך אחרת. שני הכפתורים פותרים את שלושת
                המקרים בלי שהוא צריך להבין מה מהם קרה.
              */}
              {errorCode === 'auth/email-already-in-use' && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Link
                    to="/login"
                    className="tap inline-flex items-center rounded-lg bg-rose-600 px-3
                               text-xs font-semibold text-white transition hover:bg-rose-700"
                  >
                    מעבר להתחברות
                  </Link>
                  <Link
                    to="/forgot-password"
                    className="tap inline-flex items-center rounded-lg border border-rose-300
                               bg-white px-3 text-xs font-semibold text-rose-700
                               transition hover:bg-rose-50"
                  >
                    הגדרת סיסמה חדשה
                  </Link>
                </div>
              )}
            </div>
          )}

          <Button type="submit" size="lg" fullWidth loading={busy} disabled={!canSubmit}>
            יצירת חשבון
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-500">
          כבר יש לכם חשבון?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            התחברות
          </Link>
        </p>
      </div>
    </PlainShell>
  );
}

/**
 * צעד אחרי הרשמה: הצעה לבחור תמונת פרופיל.
 *
 * לא חובה — מי שמדלג ממשיך לראות את הראשי-תיבות של השם, בדיוק כמו
 * שהיה קודם. השם עצמו כבר נשמר; זה רק הצעד האופציונלי שנשאר.
 */
function AvatarPromptStep({
  uid,
  name,
  onDone,
}: {
  uid: string;
  name: string;
  onDone: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      await uploadAvatar(uid, file, undefined);
    } catch {
      // לא קריטי — אפשר להוסיף תמונה מאוחר יותר מההגדרות
    } finally {
      setBusy(false);
      onDone();
    }
  }

  return (
    <PlainShell>
      <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
        <AppLogo showVersion={false} />

        <h1 className="mt-7 text-2xl font-bold text-ink-900">בחרו תמונת פרופיל</h1>
        <p className="mt-1 max-w-xs text-sm text-ink-500">
          ככה חברי החדר יזהו אתכם. אפשר גם לדלג — נשתמש בראשי התיבות של השם.
        </p>

        <div className="relative mt-7">
          <Avatar name={name || '?'} uid={uid} src={preview} size="lg" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            aria-label="בחירת תמונה"
            className="tap absolute -bottom-1 -end-1 grid h-9 w-9 place-items-center
                       rounded-full bg-brand-700 text-white shadow-card transition
                       hover:bg-brand-800 disabled:opacity-60"
          >
            <CameraIcon width={17} height={17} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick}
          />
        </div>

        <div className="mt-8 w-full max-w-xs space-y-2">
          <Button fullWidth loading={busy} onClick={() => fileInputRef.current?.click()}>
            בחירת תמונה
          </Button>
          <Button variant="ghost" fullWidth disabled={busy} onClick={onDone}>
            דילוג
          </Button>
        </div>
      </div>
    </PlainShell>
  );
}
