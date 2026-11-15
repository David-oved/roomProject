import { useEffect, useState } from 'react';
import { GlassModal } from '../ui/GlassModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { CheckIcon } from '../ui/icons';
import { createTask, updateTask } from '../../services/taskService';
import { useAuth } from '../../store/AuthContext';
import { useRoom } from '../../store/RoomContext';
import { useToast } from '../../store/ToastContext';
import { ALL_CATEGORIES, CATEGORY_LABELS, type Category, type Task, type WithId } from '../../types/models';
import { CATEGORY_ICON } from '../../lib/categoryIcons';
import { useHintRef } from '../../store/HintContext';

const INTERVAL_PRESETS: { label: string; days: number }[] = [
  { label: 'כל יום', days: 1 },
  { label: 'כל שבוע', days: 7 },
  { label: 'כל שבועיים', days: 14 },
  { label: 'כל חודש', days: 30 },
];

/**
 * הוספה או עריכה של מטלה קבועה — מנהל בלבד (הכפתור שפותח את זה כבר
 * מוצג רק למנהלים; ה-Rules אוכפים את זה גם בצד השרת).
 *
 * סדר הבחירה של המשתתפים הוא סדר הסבב עצמו — מי שנבחר ראשון מתחיל.
 *
 * `task` נוכח = מצב עריכה. אותו טופס בדיוק בשני המצבים במכוון: מנהל
 * שלמד להוסיף מטלה כבר יודע לערוך אותה, ושדה שקיים רק במצב אחד היה
 * הופך את שני המסלולים לשני טפסים שצריך ללמוד בנפרד.
 */
export function TaskSheet({
  open,
  onClose,
  task,
}: {
  open: boolean;
  onClose: () => void;
  task?: WithId<Task> | null;
}) {
  const { user, profile } = useAuth();
  const { roomCode, activeMembers } = useRoom();
  const toast = useToast();
  const editing = !!task;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('cleaning');
  const [intervalDays, setIntervalDays] = useState(7);
  const [participants, setParticipants] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // ‼️ מזהי הרמזים נשארים 'addTask.*' גם במצב עריכה — הם מפתח ה"כבר
  // ראיתי" ששמור אצל המשתמש, ושינוי שלהם היה מקפיץ מחדש רמזים ישנים
  // לכל המשתמשים הקיימים. במצב עריכה מעבירים undefined כדי לכבות רמז
  // שהטקסט שלו מדבר על יצירה.
  const categoryHintRef = useHintRef<HTMLButtonElement>(
    editing ? undefined : 'addTask.category',
    'בוחרים קטגוריה למטלה — לתצוגה וסינון בלבד'
  );
  const intervalHintRef = useHintRef<HTMLButtonElement>(
    editing ? undefined : 'addTask.interval',
    'קובע כל כמה זמן המטלה תחזור בסבב'
  );
  const submitHintRef = useHintRef<HTMLButtonElement>(
    editing ? undefined : 'addTask.submit',
    'שומר את המטלה החדשה ומתחיל את הסבב'
  );

  useEffect(() => {
    if (!open) return;
    setName(task?.name ?? '');
    setCategory(task?.category ?? 'cleaning');
    setIntervalDays(task?.intervalDays ?? 7);
    setParticipants(task?.participants ?? (user?.uid ? [user.uid] : []));
  }, [open, user?.uid, task]);

  function toggle(uid: string) {
    setParticipants((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  }

  const canSubmit = name.trim().length >= 2 && intervalDays >= 1 && participants.length > 0;

  async function submit() {
    if (!canSubmit || !user || !profile || !roomCode) return;
    const draft = { name: name.trim(), category, intervalDays, participants };
    setSaving(true);
    // ‼️ void מכוון: createTask מחזיר את מזהה המטלה החדשה ו-updateTask
    // לא מחזיר כלום. בלי האיחוד לטיפוס אחד ה-ternary מייצר
    // Promise<string> | Promise<void>, ואיש מהקוראים כאן לא צריך את
    // המזהה — רק את ההצלחה/כישלון ש-toast.run בודק.
    const res = await toast.run(async () => {
      if (task) await updateTask(roomCode, task, user.uid, draft);
      else await createTask(roomCode, user.uid, profile.displayName, draft);
    });
    setSaving(false);
    if (res !== null) onClose();
  }

  return (
    <GlassModal open={open} onClose={onClose} labelledBy="add-task-title">
      <div className="p-5 pt-4">
        <h2 id="add-task-title" className="pe-12 text-lg font-bold text-ink-900">
          {editing ? 'עריכת מטלה' : 'מטלה קבועה חדשה'}
        </h2>

        <div className="mt-4">
          <Input
            label="שם המטלה"
            placeholder="לדוגמה: שטיפת כלים"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
          />
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-ink-700">קטגוריה</legend>
          <div className="grid grid-cols-4 gap-2">
            {ALL_CATEGORIES.map((c, idx) => {
              const CatIcon = CATEGORY_ICON[c];
              return (
                <button
                  key={c}
                  ref={idx === 0 ? categoryHintRef : undefined}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={[
                    'tap flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-xs font-semibold transition',
                    category === c
                      ? 'border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500/30'
                      : 'border-ink-200 bg-surface text-ink-500',
                  ].join(' ')}
                >
                  <span aria-hidden>
                    <CatIcon width={17} height={17} />
                  </span>
                  {CATEGORY_LABELS[c]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-ink-700">תדירות</legend>
          <div className="grid grid-cols-4 gap-2">
            {INTERVAL_PRESETS.map((p, idx) => (
              <button
                key={p.days}
                ref={idx === 0 ? intervalHintRef : undefined}
                type="button"
                onClick={() => setIntervalDays(p.days)}
                aria-pressed={intervalDays === p.days}
                className={[
                  'tap rounded-2xl border px-1 text-xs font-semibold transition',
                  intervalDays === p.days
                    ? 'border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500/30'
                    : 'border-ink-200 bg-surface text-ink-500',
                ].join(' ')}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={365}
              value={intervalDays}
              onChange={(e) => setIntervalDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
              className="num h-11 w-20 rounded-xl border border-ink-200 px-2.5 text-center text-sm"
              aria-label="מספר ימים מותאם אישית"
            />
            <span className="text-xs text-ink-500">ימים בין חזרה לחזרה</span>
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-ink-700">
            משתתפים בסבב — סדר הבחירה הוא סדר התור
          </legend>
          <ul className="space-y-1.5">
            {activeMembers.map((m) => {
              const idx = participants.indexOf(m.id);
              const on = idx !== -1;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => toggle(m.id)}
                    aria-pressed={on}
                    className={[
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition',
                      on ? 'border-brand-300 bg-brand-50/60' : 'border-ink-200 bg-surface',
                    ].join(' ')}
                  >
                    <span
                      aria-hidden
                      className={[
                        'grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition',
                        on ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300',
                      ].join(' ')}
                    >
                      {on && <CheckIcon width={13} height={13} />}
                    </span>
                    <Avatar name={m.name} uid={m.id} src={m.avatar} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">
                      {m.name}
                      {m.id === user?.uid && <span className="text-xs text-ink-500"> (אתה)</span>}
                    </span>
                    {on && (
                      <span className="num shrink-0 text-xs font-bold text-brand-700">#{idx + 1}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <Button
          ref={submitHintRef}
          size="lg"
          fullWidth
          className="mt-5"
          loading={saving}
          disabled={!canSubmit}
          onClick={submit}
        >
          {editing ? 'שמירת שינויים' : 'יצירת מטלה'}
        </Button>
      </div>
    </GlassModal>
  );
}
