import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { useRoom } from '../store/RoomContext';
import { AboutSettings } from '../components/system/AboutSettings';

export default function SettingsAboutPage() {
  const { roomCode } = useRoom();

  return (
    <>
      <TopBar title="אודות" back={`/r/${roomCode}/settings`} />
      <PlainShell>
        <div className="py-4">
          <AboutSettings />
        </div>
      </PlainShell>
    </>
  );
}
