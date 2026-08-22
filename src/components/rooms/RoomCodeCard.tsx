import { useState } from 'react';
import { CopyIcon, ShareIcon } from '../ui/icons';
import { useToast } from '../../store/ToastContext';
import { useHintRef } from '../../store/HintContext';

/** קישור הצטרפות ישיר. HashRouter — ולכן ה-# הכרחי. */
function joinUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/rooms/join?code=${code}`;
}

export function RoomCodeCard({
  code,
  roomName,
  compact = false,
}: {
  code: string;
  roomName: string;
  compact?: boolean;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copyHintRef = useHintRef<HTMLButtonElement>(
    'rooms.copyCode',
    'מעתיק את קוד החדר ללוח כדי לשלוח ידנית'
  );
  const shareHintRef = useHintRef<HTMLButtonElement>(
    'rooms.shareCode',
    'שולח קישור הצטרפות ישיר דרך וואטסאפ, SMS או כל אפליקציה'
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('הקוד הועתק');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('לא הצלחנו להעתיק. סמנו את הקוד ידנית.');
    }
  }

  async function share() {
    const text = `הצטרפו לחדר "${roomName}" ב-RoomMate!\nקוד החדר: ${code}`;
    // navigator.share פותח את תפריט השיתוף המקורי — WhatsApp, SMS וכו'
    if (navigator.share) {
      try {
        await navigator.share({ title: 'הצטרפו לחדר שלנו', text, url: joinUrl(code) });
        return;
      } catch {
        return; // המשתמש ביטל — לא שגיאה
      }
    }
    await navigator.clipboard.writeText(`${text}\n${joinUrl(code)}`);
    toast.success('ההזמנה הועתקה');
  }

  return (
    <div
      className={
        compact
          ? 'flex items-center gap-3'
          : 'card bg-gradient-to-b from-brand-50/80 to-white p-5 text-center'
      }
    >
      <div className={compact ? 'flex-1' : ''}>
        {!compact && <p className="text-xs font-medium text-ink-500">קוד החדר</p>}
        <p
          className="num select-all font-mono text-3xl font-bold tracking-[0.3em] text-brand-800"
          style={{ direction: 'ltr' }}
        >
          {code}
        </p>
      </div>

      <div className={compact ? 'flex gap-1.5' : 'mt-4 flex justify-center gap-2'}>
        <button
          ref={copyHintRef}
          onClick={copy}
          className="tap inline-flex items-center gap-1.5 rounded-xl border border-ink-200
                     bg-surface px-3 text-sm font-semibold text-ink-700 transition
                     active:scale-95 hover:bg-ink-50"
        >
          <CopyIcon width={17} height={17} />
          {copied ? 'הועתק ✓' : 'העתק'}
        </button>
        <button
          ref={shareHintRef}
          onClick={share}
          className="tap inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-3
                     text-sm font-semibold text-white transition active:scale-95 hover:bg-brand-800"
        >
          <ShareIcon width={17} height={17} />
          שתף
        </button>
      </div>
    </div>
  );
}
