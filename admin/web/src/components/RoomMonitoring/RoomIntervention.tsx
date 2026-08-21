import { useState } from 'react';
import { api } from '../../lib/api';
import { useAction } from '../../hooks/useApi';
import { Modal, ConfirmDialog } from '../ui/Modal';
import { Badge, Field } from '../ui/primitives';
import { shekels } from '../../lib/format';
import type { RoomDetail } from '../../lib/types';

type ActionId = 'announce' | 'dm_admin' | 'force_sync' | 'reset_balances' | 'archive' | 'unarchive';

/**
 * ═══════════════════════════════════════════════════════════════
 *  כלי התערבות בחדר
 * ═══════════════════════════════════════════════════════════════
 *  הפעולות מסודרות מהעדינה להרסנית, וכל פעולה הרסנית דורשת אישור
 *  נפרד ומסבירה בדיוק מה תעשה — כולל מה *לא* תעשה.
 *
 *  ‼️ שום פעולה כאן לא מוחקת נתונים. "איפוס מאזנים" מסמן קניות
 *     כסגורות, "ארכוב" מסמן את החדר — והכול נשמר בגיבוי לפני הכתיבה,
 *     כי מנהל שטועה בלחיצה בשעה 2 בלילה הוא לא תרחיש קצה.
 * ═══════════════════════════════════════════════════════════════
 */
export function RoomIntervention({
  detail,
  onClose,
  onDone,
}: {
  detail: RoomDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, busy } = useAction();
  const [action, setAction] = useState<ActionId | null>(null);
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState<ActionId | null>(null);

  const { room, health } = detail;

  const suggestedText = () => {
    const parts = health.issues.map((i) => `• ${i.title}`);
    return parts.length
      ? `שלום, כאן צוות RoomMate. שמנו לב שבחדר "${room.name}" יש כמה דברים שדורשים טיפול:\n${parts.join(
          '\n'
        )}\n\nנשמח אם תעברו עליהם.`
      : `שלום, כאן צוות RoomMate.`;
  };

  const runAction = async (id: ActionId) => {
    const post = (body: Record<string, unknown>) =>
      api.post(`/rooms/${room.code}/action`, body);

    const result = await run(async () => {
      switch (id) {
        case 'announce':
          return post({ action: 'announce', text: text || suggestedText() });
        case 'dm_admin':
          if (!room.adminId) throw new Error('אין לחדר מנהל פעיל לשלוח אליו');
          return api.post(`/threads/${room.adminId}`, {
            text: text || suggestedText(),
            title: `בנוגע לחדר ${room.name}`,
          });
        case 'force_sync':
          return post({ action: 'force_sync' });
        case 'reset_balances':
          return post({ action: 'reset_balances', reason });
        case 'archive':
          return post({ action: 'archive', reason });
        case 'unarchive':
          return post({ action: 'unarchive' });
      }
    }, messageFor(id));

    if (result) {
      setConfirming(null);
      setAction(null);
      setText('');
      setReason('');
      onDone();
    }
  };

  return (
    <>
      <Modal
        title={`התערבות — ${room.name} (${room.code})`}
        onClose={onClose}
        footer={<button className="btn" onClick={onClose}>סגירה</button>}
      >
        <div className="row wrap mb" style={{ gap: 8 }}>
          <Badge tone={health.level === 'critical' ? 'danger' : health.level === 'risk' ? 'warn' : 'success'}>
            ציון {health.score}
          </Badge>
          <span className="small muted">
            {health.membersActive} חברים · פער מאזנים {shekels(health.spread)} · {health.openItems} מוצרים פתוחים
          </span>
        </div>

        {health.issues.length > 0 && (
          <div className="card mb" style={{ background: 'var(--gray-50)' }}>
            <div className="card__body">
              <div className="bold mb">בעיות שזוהו</div>
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                {health.issues.map((issue) => (
                  <li key={issue.code} className="small" style={{ marginBottom: 3 }}>
                    <span className="bold">{issue.title}</span>
                    {issue.detail && <span className="muted"> — {issue.detail}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="bold mb">פעולות מומלצות</div>

        <ActionRow
          title="1 · שידור לכל חברי החדר"
          description="הודעה שנכנסת ללוח ההודעות של החדר. הדרך הרכה ביותר."
          active={action === 'announce'}
          onSelect={() => {
            setAction('announce');
            setText(suggestedText());
          }}
        />
        {action === 'announce' && (
          <TextBlock value={text} onChange={setText} onSend={() => runAction('announce')} busy={busy} label="שליחת שידור" />
        )}

        <ActionRow
          title="2 · הודעה אישית למנהל החדר"
          description={room.adminId ? `נשלחת ל${room.adminName} בלבד.` : 'אין מנהל פעיל — יש להעביר ניהול תחילה.'}
          active={action === 'dm_admin'}
          disabled={!room.adminId}
          onSelect={() => {
            setAction('dm_admin');
            setText(suggestedText());
          }}
        />
        {action === 'dm_admin' && (
          <TextBlock value={text} onChange={setText} onSend={() => runAction('dm_admin')} busy={busy} label="שליחה למנהל" />
        )}

        <ActionRow
          title="3 · סנכרון כפוי"
          description="חישוב מחדש של המאזנים מתוך יומן הקניות. בטוח לחלוטין — לא משנה נתוני מקור."
          active={false}
          onSelect={() => runAction('force_sync')}
        />

        <div className="divider" />
        <div className="bold mb" style={{ color: 'var(--danger)' }}>פעולות שדורשות זהירות</div>

        <ActionRow
          title="4 · איפוס מאזנים"
          description="כל הקניות המאושרות מסומנות כסגורות והמאזנים מתאפסים. הקניות עצמן נשארות ביומן."
          active={false}
          danger
          onSelect={() => setConfirming('reset_balances')}
        />

        {room.archivedAt ? (
          <ActionRow
            title="5 · ביטול ארכוב"
            description="החדר יחזור לפעילות מלאה."
            active={false}
            onSelect={() => runAction('unarchive')}
          />
        ) : (
          <ActionRow
            title="5 · ארכוב החדר"
            description="החדר מסומן כלא פעיל. הנתונים נשמרים במלואם וניתן לשחזר."
            active={false}
            danger
            onSelect={() => setConfirming('archive')}
          />
        )}
      </Modal>

      {confirming && (
        <ConfirmDialog
          title={confirming === 'archive' ? 'ארכוב החדר?' : 'איפוס מאזנים?'}
          danger
          busy={busy}
          confirmLabel={confirming === 'archive' ? 'ארכב' : 'אפס מאזנים'}
          message={
            confirming === 'archive'
              ? `החדר "${room.name}" יסומן כמאורכב. הנתונים נשמרים ואפשר לבטל בכל רגע.`
              : `כל הקניות המאושרות ב"${room.name}" יסומנו כסגורות והמאזנים יתאפסו. נשמר גיבוי מלא לפני הפעולה.`
          }
          onCancel={() => setConfirming(null)}
          onConfirm={() => runAction(confirming)}
        >
          <Field label="סיבה (נשמרת ביומן הביקורת)">
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </ConfirmDialog>
      )}
    </>
  );
}

function ActionRow({
  title,
  description,
  active,
  danger,
  disabled,
  onSelect,
}: {
  title: string;
  description: string;
  active: boolean;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className="row between"
      style={{
        border: `1px solid ${active ? 'var(--navy-700)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        padding: '9px 12px',
        marginBottom: 8,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="bold small">{title}</div>
        <div className="tiny muted">{description}</div>
      </div>
      <button className={`btn sm ${danger ? 'danger' : ''}`} onClick={onSelect} disabled={disabled}>
        {danger ? 'ביצוע' : 'בחירה'}
      </button>
    </div>
  );
}

function TextBlock({
  value,
  onChange,
  onSend,
  busy,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  label: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <textarea className="textarea" value={value} onChange={(e) => onChange(e.target.value)} />
      <button className="btn primary sm mt" onClick={onSend} disabled={busy || !value.trim()}>
        {busy ? 'שולח…' : label}
      </button>
    </div>
  );
}

function messageFor(id: ActionId): string {
  const map: Record<ActionId, string> = {
    announce: 'השידור נשלח לחדר',
    dm_admin: 'ההודעה נשלחה למנהל החדר',
    force_sync: 'המאזנים חושבו מחדש',
    reset_balances: 'המאזנים אופסו (עם גיבוי)',
    archive: 'החדר אורכב',
    unarchive: 'הארכוב בוטל',
  };
  return map[id];
}
