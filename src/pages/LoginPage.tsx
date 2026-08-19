import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Input, PasswordInput } from '../components/ui/Input';
import { authErrorMessage, login } from '../services/authService';
import { getLastEmail, setLastEmail } from '../lib/prefs';
import { useConnection } from '../store/ConnectionContext';
import { AppLogo } from '../components/layout/AppLogo';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOnline } = useConnection();

  // חוסך הקלדה חוזרת — האימייל אינו סוד
  const [email, setEmail] = useState(getLastEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      setLastEmail(email);
      // ‼️ from הוא אובייקט Location שלם, לא מחרוזת — String(from) היה
      // מייצר "[object Object]" ומנווט לכתובת לא תקינה. מרכיבים נתיב
      // אמיתי מהשדות שלו.
      const from = (location.state as { from?: Location })?.from;
      const target = from ? `${from.pathname}${from.search}${from.hash}` : '/onboarding';
      navigate(target || '/onboarding', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlainShell>
      <div className="flex flex-1 flex-col justify-center py-6">
        <AppLogo />

        <h1 className="mt-7 text-2xl font-bold text-ink-900">ברוכים השבים 👋</h1>
        <p className="mt-1 text-sm text-ink-500">התחברו כדי להמשיך לנהל את החדר</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
          <Input
            label="אימייל"
            type="email"
            inputMode="email"
            autoComplete="email"
            enterKeyHint="next"
            dir="ltr"
            className="text-start"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <PasswordInput
            label="סיסמה"
            autoComplete="current-password"
            placeholder="••••••••"
            enterKeyHint="go"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          )}

          {!isOnline && (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              📡 אין חיבור לאינטרנט. התחברות ראשונה דורשת חיבור.
            </p>
          )}

          <Button type="submit" size="lg" fullWidth loading={busy} disabled={!isOnline}>
            התחברות
          </Button>
        </form>

        <div className="mt-5 space-y-3 text-center text-sm">
          <Link to="/forgot-password" className="block text-brand-700 hover:underline">
            שכחתי סיסמה
          </Link>
          <p className="text-ink-500">
            אין לכם חשבון?{' '}
            <Link to="/register" className="font-semibold text-brand-700 hover:underline">
              הרשמה
            </Link>
          </p>
        </div>
      </div>
    </PlainShell>
  );
}
