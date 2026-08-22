import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { RoomArchivedBanner } from '../components/system/RoomArchivedBanner';
import { TopBar } from '../components/layout/TopBar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { Input } from '../components/ui/Input';
import { CartIcon, CheckIcon, CloseIcon, TrashIcon } from '../components/ui/icons';
import { AddTripLineSheet } from '../components/trip/AddTripLineSheet';
import { useActiveTripId, useTrip } from '../hooks/useTrip';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import { useConnection } from '../store/ConnectionContext';
import { useToast } from '../store/ToastContext';
import { useConfirm } from '../store/ConfirmContext';
import {
  cancelTrip,
  createTrip,
  finalizeTrip,
  removeTripLine,
  setTripLineState,
  startShopping,
} from '../services/tripService';
import { formatILS, toAgorot } from '../lib/format';
import { friendlyError } from '../lib/errors';
import { CATEGORY_ICON } from '../lib/categoryIcons';
import type { TripLine, TripLineState, WithId } from '../types/models';

export default function TripPage() {
  const navigate = useNavigate();
  const { roomCode, isArchived } = useRoom();
  const { isOnline } = useConnection();
  const toast = useToast();
  const canWrite = isOnline && !isArchived;

  const activeTripId = useActiveTripId();
  const { trip, lines, loading, error, fromCache } = useTrip(activeTripId.data);
  const [addOpen, setAddOpen] = useState(false);

  const loadingAny = activeTripId.loading || (!!activeTripId.data && loading);

  return (
    <AppShell>
      <TopBar title="קנייה גדולה" />
      <RoomArchivedBanner />

      <div className="pt-4">
        {loadingAny ? (
          <ListSkeleton rows={4} />
        ) : (error ?? activeTripId.error) && !fromCache ? (
          <ErrorState message={friendlyError(error ?? activeTripId.error)} onRetry={() => location.reload()} />
        ) : !activeTripId.data || !trip || trip.status === 'done' || trip.status === 'cancelled' ? (
          <NoActiveTrip canWrite={canWrite} />
        ) : (
          <ActiveTrip
            tripId={activeTripId.data}
            trip={trip}
            lines={lines}
            canWrite={canWrite}
            onAdd={() => setAddOpen(true)}
            onFinalized={() => {
              toast.success('הקנייה הגדולה נסגרה — הכסף נכנס למאזן');
              navigate(`/r/${roomCode}/balances`);
            }}
          />
        )}
      </div>

      {addOpen && activeTripId.data && (
        <AddTripLineSheet
          open
          onClose={() => setAddOpen(false)}
          tripId={activeTripId.data}
          existingLines={lines}
        />
      )}
    </AppShell>
  );
}

/* ═══════════════ אין קנייה גדולה פעילה ═══════════════ */

function NoActiveTrip({ canWrite }: { canWrite: boolean }) {
  const { roomCode } = useRoom();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function start() {
    const title = await confirm.prompt({
      title: 'קנייה גדולה חדשה',
      label: 'שם לקנייה (אופציונלי)',
      placeholder: 'לדוגמה: קנייה שבועית',
      optional: true,
      confirmLabel: 'התחלה',
    });
    if (title === null) return;

    setBusy(true);
    await toast.run(() => createTrip(roomCode!, user!.uid, title || 'קנייה גדולה'));
    setBusy(false);
  }

  return (
    <EmptyState
      icon={<CartIcon width={30} height={30} />}
      title="אין קנייה גדולה פעילה"
      body="בונים רשימה משותפת, מישהו יוצא לסופר, והקנייה מתחלקת שווה בשווה בסיום."
      action={
        <Button onClick={start} disabled={!canWrite || busy} loading={busy}>
          התחלת קנייה גדולה
        </Button>
      }
    />
  );
}

/* ═══════════════ קנייה גדולה פעילה ═══════════════ */

function ActiveTrip({
  tripId,
  trip,
  lines,
  canWrite,
  onAdd,
  onFinalized,
}: {
  tripId: string;
  trip: NonNullable<ReturnType<typeof useTrip>['trip']>;
  lines: WithId<TripLine>[];
  canWrite: boolean;
  onAdd: () => void;
  onFinalized: () => void;
}) {
  const { roomCode, activeMembers, isAdmin, memberName } = useRoom();
  const { user, profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [receiptText, setReceiptText] = useState('');

  const isShopping = trip.status === 'shopping';
  const iAmShopper = isShopping && trip.shopperId === user?.uid;
  const canCancel =
    trip.createdBy === user?.uid || trip.shopperId === user?.uid || isAdmin;

  const boughtCount = lines.filter((l) => l.state === 'bought').length;
  const receiptAmount = useMemo(() => {
    const n = Number(receiptText.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? toAgorot(n) : 0;
  }, [receiptText]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    await toast.run(fn);
    setBusy(false);
  }

  async function onCancel() {
    const ok = await confirm({
      title: 'ביטול קנייה גדולה',
      body: 'הרשימה תישמר בהיסטוריה אבל תסומן כמבוטלת — אין ממנה חזרה.',
      confirmLabel: 'ביטול הקנייה',
      danger: true,
    });
    if (!ok) return;
    await run(() => cancelTrip(roomCode!, tripId, user!.uid));
  }

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-ink-900">{trip.title}</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              {lines.length} פריטים ברשימה
              {isShopping &&
                trip.shopperId &&
                ` · יוצא/ת לסופר: ${trip.shopperId === user?.uid ? 'אתה' : memberName(trip.shopperId)}`}
            </p>
          </div>
          <Badge tone={isShopping ? 'brand' : 'neutral'}>{isShopping ? 'בסופר' : 'בבנייה'}</Badge>
        </div>

        {isShopping && trip.shopperId !== user?.uid && (
          <p className="mt-3 rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-900">
            הקנייה בעיצומה — רק מי שיצא/ה לסופר יכול/ה לסגור אותה.
          </p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-ink-700">
            הרשימה {isShopping && `· ${boughtCount}/${lines.length} נקנו`}
          </h3>
          <button
            onClick={onAdd}
            disabled={!canWrite}
            className="tap-area text-xs font-semibold text-brand-700 disabled:text-ink-300"
          >
            + הוספה
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="rounded-card border border-ink-200/70 bg-surface px-4 py-8 text-center">
            <p className="text-sm font-semibold text-ink-800">הרשימה ריקה</p>
            <p className="mt-0.5 text-xs text-ink-500">הוסיפו מוצרים לפני שיוצאים לסופר.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {lines.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                tripId={tripId}
                roomCode={roomCode!}
                canWrite={canWrite}
                isShopping={isShopping}
              />
            ))}
          </ul>
        )}
      </section>

      {!isShopping && (
        <Button
          size="lg"
          fullWidth
          disabled={!canWrite || busy || lines.length === 0}
          loading={busy}
          onClick={() => run(() => startShopping(roomCode!, tripId, user!.uid))}
        >
          יצאתי לסופר
        </Button>
      )}

      {iAmShopper && (
        <section className="card space-y-3 p-4">
          <h3 className="text-sm font-bold text-ink-700">סיום הקנייה</h3>
          <Input
            label="כמה יצא בחשבונית?"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={receiptText}
            onChange={(e) => setReceiptText(e.target.value)}
            suffix="₪"
          />
          <p className="text-xs leading-relaxed text-ink-500">
            הסכום יתחלק שווה בשווה בין {activeMembers.length} החברים הפעילים בחדר, ויירשם על
            שמך — בלי אישור מנהל.
          </p>
          <Button
            size="lg"
            fullWidth
            disabled={!canWrite || busy || receiptAmount <= 0}
            loading={busy}
            onClick={() =>
              run(() =>
                finalizeTrip(
                  roomCode!,
                  tripId,
                  user!.uid,
                  profile!.displayName,
                  activeMembers.map((m) => m.id),
                  receiptAmount
                ).then(onFinalized)
              )
            }
          >
            סיום קנייה{receiptAmount > 0 ? ` · ${formatILS(receiptAmount)}` : ''}
          </Button>
        </section>
      )}

      {canCancel && (
        <button
          disabled={!canWrite || busy}
          onClick={onCancel}
          className="tap-area w-full text-center text-xs font-semibold text-rose-600 disabled:text-ink-300"
        >
          ביטול הקנייה הגדולה
        </button>
      )}
    </div>
  );
}

function LineRow({
  line,
  tripId,
  roomCode,
  canWrite,
  isShopping,
}: {
  line: WithId<TripLine>;
  tripId: string;
  roomCode: string;
  canWrite: boolean;
  isShopping: boolean;
}) {
  const { user } = useAuth();
  const { isAdmin } = useRoom();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const Icon = CATEGORY_ICON[line.category];

  async function toggle(state: TripLineState) {
    setBusy(true);
    await toast.run(() =>
      setTripLineState(roomCode, tripId, line.id, line.state === state ? 'planned' : state)
    );
    setBusy(false);
  }

  const canRemove = line.addedBy === user?.uid || isAdmin;

  return (
    <li
      className={[
        'flex items-center gap-2.5 rounded-xl border bg-surface px-3 py-2.5 transition',
        line.state === 'bought'
          ? 'border-emerald-200 bg-emerald-50/50'
          : line.state === 'not_found'
            ? 'border-ink-200 bg-ink-50/60 opacity-70'
            : 'border-ink-100',
      ].join(' ')}
    >
      <Icon width={16} height={16} className="shrink-0 text-ink-500" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
        {line.name}
        {line.qty > 1 && <span className="text-ink-500"> ×{line.qty}</span>}
      </span>

      {isShopping ? (
        <div className="flex shrink-0 gap-1">
          <button
            aria-label="נקנה"
            aria-pressed={line.state === 'bought'}
            disabled={!canWrite || busy}
            onClick={() => toggle('bought')}
            className={[
              'tap grid h-8 w-8 place-items-center rounded-lg border transition',
              line.state === 'bought'
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-ink-200 text-ink-400 hover:border-emerald-400 hover:text-emerald-600',
            ].join(' ')}
          >
            <CheckIcon width={14} height={14} />
          </button>
          <button
            aria-label="לא נמצא"
            aria-pressed={line.state === 'not_found'}
            disabled={!canWrite || busy}
            onClick={() => toggle('not_found')}
            className={[
              'tap grid h-8 w-8 place-items-center rounded-lg border transition',
              line.state === 'not_found'
                ? 'border-rose-500 bg-rose-500 text-white'
                : 'border-ink-200 text-ink-400 hover:border-rose-400 hover:text-rose-600',
            ].join(' ')}
          >
            <CloseIcon width={14} height={14} />
          </button>
        </div>
      ) : (
        canRemove && (
          <button
            aria-label={`הסרת ${line.name}`}
            disabled={!canWrite || busy}
            onClick={async () => {
              setBusy(true);
              await toast.run(() => removeTripLine(roomCode, tripId, line.id));
              setBusy(false);
            }}
            className="tap grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-400
                       transition hover:bg-rose-50 hover:text-rose-600"
          >
            <TrashIcon width={14} height={14} />
          </button>
        )
      )}
    </li>
  );
}
