import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { useRoom } from '../store/RoomContext';
import { NotificationSettings } from '../components/system/NotificationSettings';

export default function SettingsNotificationsPage() {
  const { roomCode } = useRoom();

  return (
    <>
      <TopBar
        title="התראות"
        subtitle="בחרו על מה תרצו לקבל התראה"
        back={`/r/${roomCode}/settings`}
      />
      <PlainShell hasTopBar>
        <div className="py-4">
          <NotificationSettings />
        </div>
      </PlainShell>
    </>
  );
}
