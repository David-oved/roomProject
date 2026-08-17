import { Link } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <PlainShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div aria-hidden className="text-5xl">
          🧭
        </div>
        <h1 className="text-xl font-bold text-ink-900">הדף לא נמצא</h1>
        <p className="max-w-xs text-sm text-ink-500">
          הקישור שגוי או שהדף כבר לא קיים.
        </p>
        <Link to="/" className="mt-4 w-full max-w-xs">
          <Button size="lg" fullWidth>
            חזרה לדף הבית
          </Button>
        </Link>
      </div>
    </PlainShell>
  );
}
