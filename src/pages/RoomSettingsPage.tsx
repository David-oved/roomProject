import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import { useConnection } from '../store/ConnectionContext';
import { useToast } from '../store/ToastContext';
import { useConfirm } from '../store/ConfirmContext';
import { useBalances } from '../hooks/useRoomData';
import {
  deleteRoom,
  exportRoom,
  leaveRoom,
  transferAdmin,
  updateRoomMetadata,
} from '../services/roomService';
import { slugifyRoomName } from '../lib/roomCode';
import { formatILS } from '../lib/format';

export default function RoomSettingsPage() {
  const { roomCode, metadata, activeMembers, members, isAdmin } = useRoom();
  const { user } = useAuth();
  const { isOnline } = useConnection();
  const { balances } = useBalances();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [name, setName] = useState(metadata?.name ?? '');
  const [description, setDescription] = useState(metadata?.description ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const openDebts = Object.entries(balances).filter(([, v]) => v !== 0);
  const dirty =
    name.trim() !== metadata?.name || description.trim() !== (metadata?.description ?? '');
  const others = activeMembers.filter((m) => m.id !== user?.uid);

  async function save() {
    setBusy(true);
    const res = await toast.run(() =>
      updateRoomMetadata(roomCode!, metadata?.name ?? '', { name, description })
    );
    if (res !== null) toast.success('ההגדרות נשמרו');
    setBusy(false);
  }

  async function downloadBackup() {
    const json = await toast.run(() => exportRoom(roomCode!));
    if (json === null) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roommate-${roomCode}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <TopBar title="הגדרות החדר" back={`/r/${roomCode}`} />
      <PlainShell>
        <div className="space-y-6 py-4">
          {/* פרטי החדר */}
          <section className="card space-y-4 p-4">
            <h2 className="text-sm font-bold text-ink-700">פרטי החדר</h2>
            <Input
              label="שם החדר"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
            <Textarea
              label="תיאור"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
            />
            <Button fullWidth loading={busy} disabled={!dirty || !isOnline} onClick={save}>
              שמירת שינויים
            </Button>
          </section>

          {/* העברת ניהול */}
          {isAdmin && others.length > 0 && (
            <section className="card p-4">
              <h2 className="text-sm font-bold text-ink-700">העברת ניהול החדר</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                לאחר ההעברה תהפכו לחבר רגיל ולא תוכלו לאשר קניות או חברים.
              </p>
              <ul className="mt-3 space-y-2">
                {others.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <Avatar name={m.name} uid={m.id} src={m.avatar} size="xs" />
                    <span className="flex-1 truncate text-sm text-ink-800">{m.name}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!isOnline}
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'העברת ניהול',
                          body: `להעביר את ניהול החדר ל${m.name}? תהפכו לחבר רגיל ולא תוכלו לאשר קניות או חברים.`,
                          confirmLabel: 'העבר ניהול',
                          danger: true,
                        });
                        if (!ok) return;
                        const res = await toast.run(() =>
                          transferAdmin(roomCode!, user!.uid, m.id)
                        );
                        if (res !== null) {
                          toast.success(`${m.name} הוא מנהל החדר`);
                          navigate(`/r/${roomCode}`);
                        }
                      }}
                    >
                      העבר
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* גיבוי */}
          <section className="card p-4">
            <h2 className="text-sm font-bold text-ink-700">גיבוי</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              הורדת קובץ JSON עם כל תוכן החדר — מוצרים, קניות, חברים ומאזנים.
            </p>
            <Button
              variant="secondary"
              fullWidth
              className="mt-3"
              disabled={!isOnline}
              onClick={downloadBackup}
            >
              הורד גיבוי
            </Button>
          </section>

          {/* אזור מסוכן */}
          <section className="rounded-card border border-rose-200 bg-rose-50/40 p-4">
            <h2 className="text-sm font-bold text-rose-800">אזור מסוכן</h2>

            {!isAdmin ? (
              <>
                <p className="mt-1 text-xs leading-relaxed text-ink-600">
                  עזיבת החדר. הקניות והמאזן שלכם יישמרו בהיסטוריה.
                </p>
                <Button
                  variant="danger"
                  fullWidth
                  className="mt-3"
                  disabled={!isOnline}
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'עזיבת החדר',
                      body: 'הקניות והמאזן שלכם יישמרו בהיסטוריה. תוכלו לבקש להצטרף מחדש בעתיד.',
                      confirmLabel: 'עזוב את החדר',
                      danger: true,
                    });
                    if (!ok) return;
                    const res = await toast.run(() => leaveRoom(roomCode!, user!.uid));
                    if (res !== null) navigate('/onboarding', { replace: true });
                  }}
                >
                  עזיבת החדר
                </Button>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs leading-relaxed text-ink-600">
                  מחיקת החדר היא <b>בלתי הפיכה</b>. יימחקו כל המוצרים, הקניות, החברים והמאזנים.
                </p>

                {openDebts.length > 0 ? (
                  <div className="mt-3 rounded-xl bg-white p-3 text-xs text-rose-800">
                    🔒 לא ניתן למחוק חדר עם חובות פתוחים. סגרו קודם את החשבונות:
                    <ul className="mt-1.5 space-y-0.5">
                      {openDebts.map(([uid, v]) => (
                        <li key={uid} className="num flex justify-between">
                          <span>{members.find((m) => m.id === uid)?.name ?? uid}</span>
                          <span>{formatILS(v)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <>
                    <Input
                      label={`הקלידו "${metadata?.name}" לאישור`}
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="mt-3"
                    />
                    <Button
                      variant="danger"
                      fullWidth
                      className="mt-3"
                      disabled={!isOnline || confirmText.trim() !== metadata?.name}
                      onClick={async () => {
                        const res = await toast.run(() =>
                          deleteRoom(
                            roomCode!,
                            members.map((m) => m.id),
                            slugifyRoomName(metadata!.name)
                          )
                        );
                        if (res !== null) {
                          toast.success('החדר נמחק');
                          navigate('/onboarding', { replace: true });
                        }
                      }}
                    >
                      מחק את החדר לצמיתות
                    </Button>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </PlainShell>
    </>
  );
}
