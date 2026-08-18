import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LogoutIcon, RefreshIcon } from '../components/ui/icons';
import { useAuth } from '../store/AuthContext';
import { useConnection } from '../store/ConnectionContext';
import { useToast } from '../store/ToastContext';
import { useConfirm } from '../store/ConfirmContext';
import { useUpdate } from '../store/UpdateContext';
import { changeDisplayName, logout } from '../services/authService';
import { APP_VERSION, BUILD_TIME } from '../lib/version';
import { formatSmartDate } from '../lib/format';

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const { isOnline } = useConnection();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { status, remote, checkNow, applyUpdate } = useUpdate();

  const [name, setName] = useState(profile?.displayName ?? '');
  const [busy, setBusy] = useState(false);

  const dirty = name.trim() !== profile?.displayName && name.trim().length >= 2;

  async function save() {
    if (!user) return;
    setBusy(true);
    const res = await toast.run(() => changeDisplayName(user.uid, name, profile?.rooms));
    if (res !== null) toast.success('השם עודכן בכל החדרים');
    setBusy(false);
  }

  return (
    <>
      <TopBar title="החשבון שלי" back />
      <PlainShell>
        <div className="space-y-6 py-4">
          {/* פרופיל */}
          <section className="flex flex-col items-center gap-3">
            <Avatar
              name={profile?.displayName ?? '?'}
              uid={user?.uid}
              src={profile?.avatar}
              size="lg"
            />
            <div className="text-center">
              <p className="font-bold text-ink-900">{profile?.displayName}</p>
              <p className="num text-sm text-ink-500" dir="ltr">
                {profile?.email}
              </p>
            </div>
          </section>

          {/* שינוי שם */}
          <section className="card space-y-3 p-4">
            <Input
              label="שם תצוגה"
              value={name}
              onChange={(e) => setName(e.target.value)}
              hint="השם יתעדכן בכל החדרים שאתם חברים בהם"
              maxLength={40}
            />
            <Button fullWidth loading={busy} disabled={!dirty || !isOnline} onClick={save}>
              שמירה
            </Button>
          </section>

          {/* גרסה ועדכונים */}
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-bold text-ink-700">גרסת האפליקציה</h2>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">גרסה מותקנת</dt>
                <dd className="num font-semibold text-ink-900">{APP_VERSION}</dd>
              </div>
              {remote && (
                <div className="flex justify-between">
                  <dt className="text-ink-500">גרסה בשרת</dt>
                  <dd
                    className={`num font-semibold ${
                      remote.version === APP_VERSION ? 'text-ink-900' : 'text-brand-700'
                    }`}
                  >
                    {remote.version}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-500">נבנתה</dt>
                <dd className="text-ink-600">{formatSmartDate(new Date(BUILD_TIME).getTime())}</dd>
              </div>
            </dl>

            <div className="mt-4">
              {status === 'available' ? (
                <Button fullWidth onClick={applyUpdate} icon={<RefreshIcon width={18} height={18} />}>
                  עדכן לגרסה {remote?.version}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={!isOnline || status === 'checking'}
                  loading={status === 'checking'}
                  onClick={checkNow}
                  icon={<RefreshIcon width={18} height={18} />}
                >
                  {status === 'current' ? 'האפליקציה מעודכנת ✓' : 'בדוק אם יש עדכון'}
                </Button>
              )}
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
              האפליקציה בודקת עדכונים אוטומטית בכל כניסה. עדכון מוריד מחדש את כל קבצי
              האפליקציה.
            </p>
          </section>

          {/* יציאה */}
          <Button
            variant="secondary"
            fullWidth
            size="lg"
            icon={<LogoutIcon width={18} height={18} />}
            onClick={async () => {
              const ok = await confirm({
                title: 'יציאה מהחשבון',
                body: 'הנתונים השמורים במכשיר יימחקו. תצטרכו להתחבר מחדש.',
                confirmLabel: 'התנתק',
              });
              if (!ok) return;
              await logout();
              navigate('/login', { replace: true });
            }}
          >
            יציאה מהחשבון
          </Button>

          <p className="text-center text-[11px] text-ink-400">
            היציאה מנקה את כל הנתונים השמורים במכשיר
          </p>
        </div>
      </PlainShell>
    </>
  );
}
