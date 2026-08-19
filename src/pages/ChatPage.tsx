import { AppShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { ChatIcon } from '../components/ui/icons';
import { useRoom } from '../store/RoomContext';

/**
 * צ'אט חכם של החדר — טרם תוכנן. זהו רק מיקום-שומר בניווט, כדי שהמסלול
 * וטאב הניווט יהיו קיימים כשהעיצוב יגיע.
 */
export default function ChatPage() {
  const { metadata } = useRoom();

  return (
    <AppShell>
      <TopBar title="צ'אט" subtitle={metadata?.name} />

      <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink-100 text-ink-500">
          <ChatIcon width={26} height={26} />
        </span>
        <p className="font-bold text-ink-900">הצ'אט החכם של החדר בדרך</p>
        <p className="max-w-xs text-sm leading-relaxed text-ink-500">
          כאן יהיה אפשר לדבר עם חברי החדר ולקבל עזרה חכמה על קניות, חובות ומוצרים —
          עדיין בתכנון.
        </p>
      </div>
    </AppShell>
  );
}
