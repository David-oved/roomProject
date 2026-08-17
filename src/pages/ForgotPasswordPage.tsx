import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { authErrorMessage, resetPassword } from '../services/authService';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlainShell>
      <div className="flex flex-1 flex-col justify-center py-6">
        {sent ? (
          <div className="text-center">
            <div aria-hidden className="text-5xl">
              📬
            </div>
            <h1 className="mt-4 text-xl font-bold text-ink-900">המייל נשלח</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              אם קיים חשבון עבור <span className="num font-medium">{email}</span>, נשלח אליו
              קישור לאיפוס הסיסמה. הקישור תקף לשעה.
            </p>
            <p className="mt-3 text-xs text-ink-400">
              לא רואים את המייל? בדקו בתיקיית הספאם.
            </p>
            <Link to="/login" className="mt-6 block">
              <Button variant="secondary" size="lg" fullWidth>
                חזרה להתחברות
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-ink-900">איפוס סיסמה</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
              הזינו את האימייל שאיתו נרשמתם, ונשלח אליכם קישור לבחירת סיסמה חדשה.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
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

              {error && (
                <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={busy}
                disabled={!email.includes('@')}
              >
                שליחת קישור
              </Button>
            </form>

            <Link
              to="/login"
              className="mt-5 block text-center text-sm text-ink-500 hover:underline"
            >
              חזרה להתחברות
            </Link>
          </>
        )}
      </div>
    </PlainShell>
  );
}
