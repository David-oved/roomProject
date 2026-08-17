import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { AppLogo } from '../components/layout/AppLogo';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { authErrorMessage, register } from '../services/authService';
import { useConnection } from '../store/ConnectionContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { isOnline } = useConnection();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
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
    setBusy(true);
    try {
      await register(email, password, name);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
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
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              {error}
            </p>
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
