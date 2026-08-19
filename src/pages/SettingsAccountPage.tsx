import { useNavigate } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { LogoutIcon } from '../components/ui/icons';
import { useRoom } from '../store/RoomContext';
import { useConfirm } from '../store/ConfirmContext';
import { logout } from '../services/authService';
import { AccountSettings } from '../components/system/AccountSettings';

export default function SettingsAccountPage() {
  const { roomCode } = useRoom();
  const navigate = useNavigate();
  const confirm = useConfirm();

  return (
    <>
      <TopBar title="חשבון" back={`/r/${roomCode}/settings`} />
      <PlainShell>
        <div className="space-y-6 py-4">
          <AccountSettings />
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
        </div>
      </PlainShell>
    </>
  );
}
