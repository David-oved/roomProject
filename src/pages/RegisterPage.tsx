import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { AppLogo } from '../components/layout/AppLogo';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { authErrorCode, authErrorMessage, register } from '../services/authService';
import { useConnection } from '../store/ConnectionContext';

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
      await register(email, password, name);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
      setErrorCode(authErrorCode(err));
    } finally {
      setBusy(false);
    }
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

          <Input
            label="סיסמה"
            type="password"
            autoComplete="new-password"
            placeholder="לפחות 6 תווים"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passError}
            required
          />

          <Input
            label="אימות סיסמה"
            type="password"
            autoComplete="new-password"
            placeholder="שוב, בבקשה"
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
