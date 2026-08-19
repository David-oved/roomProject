import { useNavigate } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { LogoutIcon } from '../components/ui/icons';
import { useConfirm } from '../store/ConfirmContext';
import { logout } from '../services/authService';
import { AccountSettings } from '../components/system/AccountSettings';
import { NotificationSettings } from '../components/system/NotificationSettings';
import { AboutSettings } from '../components/system/AboutSettings';

/**
 * מסך חשבון עצמאי — למשתמש בלי חדר פעיל (למשל באמצע Onboarding).
 * מי שכבר בתוך חדר מגיע ל-SettingsPage המאוחד, שכולל את אותו תוכן
 * בדיוק בטאב "חשבון" בתוך הקשר החדר.
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const confirm = useConfirm();

  return (
    <>
      <TopBar title="החשבון שלי" back />
      <PlainShell>
        <div className="space-y-6 py-4">
          <AccountSettings />
          <NotificationSettings />
          <AboutSettings />

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
