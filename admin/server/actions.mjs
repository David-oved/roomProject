import { pushId } from './db.mjs';
import { computeBalances } from './money.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  פעולות התערבות
 * ═══════════════════════════════════════════════════════════════
 *  כל מה שכותב לבסיס הנתונים עובר דרך כאן, ולא ישירות מה-API.
 *
 *  ‼️ שני כללים שאין להם יוצא מן הכלל:
 *   1. כל פעולה נרשמת ביומן הביקורת (adminConsole/auditLog) — כולל מי,
 *      מתי, על מה, ומה היה הערך הקודם. פעולת מנהל שלא נרשמה היא
 *      בדיוק הדבר שאי אפשר להסביר חודש אחרי.
 *   2. פעולה הרסנית (איפוס מאזנים, ארכוב חדר) שומרת גיבוי מלא של
 *      הצומת לפני הכתיבה, תחת adminConsole/backups.
 * ═══════════════════════════════════════════════════════════════
 */

const CONSOLE = 'adminConsole';

async function audit(db, entry) {
  const id = pushId();
  await db.set(`${CONSOLE}/auditLog/${id}`, {
    at: Date.now(),
    actor: 'admin-console',
    ...entry,
  });
  return id;
}

async function backup(db, path, label) {
  const value = await db.get(path);
  const id = pushId();
  await db.set(`${CONSOLE}/backups/${id}`, {
    path,
    label,
    at: Date.now(),
    value: value ?? null,
  });
  return id;
}

/* ═══════════ קניות ═══════════ */

export async function approvePurchase(db, state, { roomCode, purchaseId }) {
  const room = state.get().world.rooms.get(roomCode);
  if (!room) throw new Error('חדר לא נמצא');
  const purchase = room.purchases.find((p) => p.id === purchaseId);
  if (!purchase) throw new Error('קנייה לא נמצאה');
  if (purchase.status === 'approved') return { ok: true, alreadyDone: true };

  await db.update(`rooms/${roomCode}/purchases/${purchaseId}`, {
    status: 'approved',
    approvedBy: room.adminId ?? 'admin-console',
  });
  await recomputeBalances(db, state, roomCode);
  await audit(db, {
    action: 'purchase_approved',
    roomCode,
    entityId: purchaseId,
    detail: `${purchase.title} · ${purchase.amount} אגורות`,
    previous: { status: purchase.status },
  });
  return { ok: true };
}

export async function rejectPurchase(db, state, { roomCode, purchaseId, reason }) {
  const room = state.get().world.rooms.get(roomCode);
  const purchase = room?.purchases.find((p) => p.id === purchaseId);
  if (!purchase) throw new Error('קנייה לא נמצאה');

  await db.update(`rooms/${roomCode}/purchases/${purchaseId}`, {
    status: 'rejected',
    approvedBy: room.adminId ?? 'admin-console',
    ...(reason ? { note: reason } : {}),
  });
  await recomputeBalances(db, state, roomCode);
  await audit(db, {
    action: 'purchase_rejected',
    roomCode,
    entityId: purchaseId,
    detail: reason ?? null,
    previous: { status: purchase.status },
  });
  return { ok: true };
}

/**
 * חישוב מחדש של המאזנים השמורים.
 * המאזן הוא נתון נגזר (ראו src/lib/money.ts) — הצומת rooms/x/balances
 * הוא רק מטמון לתצוגה מהירה, ולכן תמיד מותר לדרוס אותו בחישוב טרי.
 */
export async function recomputeBalances(db, state, roomCode) {
  const snapshot = db.snapshot();
  const raw = snapshot.rooms?.[roomCode];
  if (!raw) throw new Error('חדר לא נמצא');

  const members = Object.entries(raw.members ?? {})
    .filter(([, m]) => m.status === 'active')
    .map(([uid]) => uid);
  const purchases = Object.values(raw.purchases ?? {});
  const settlements = Object.values(raw.settlements ?? {});
  const balances = computeBalances(purchases, settlements, members);

  const now = Date.now();
  const payload = {};
  for (const [uid, amount] of Object.entries(balances)) {
    payload[uid] = { amount, lastUpdated: now };
  }
  await db.set(`rooms/${roomCode}/balances`, payload);
  state.invalidate();
  return balances;
}

/* ═══════════ חברים ═══════════ */

export async function approveJoinRequest(db, state, { roomCode, uid }) {
  const snapshot = db.snapshot();
  const request = snapshot.rooms?.[roomCode]?.pendingRequests?.[uid];
  if (!request) throw new Error('בקשה לא נמצאה');

  await db.set(`rooms/${roomCode}/members/${uid}`, {
    name: request.displayName ?? uid,
    email: request.email ?? '',
    avatar: request.avatar ?? null,
    joinedAt: Date.now(),
    status: 'active',
    role: 'member',
  });
  await db.update(`rooms/${roomCode}/pendingRequests/${uid}`, {
    status: 'approved',
    respondedAt: Date.now(),
  });
  await db.set(`users/${uid}/rooms/${roomCode}`, true);
  await audit(db, { action: 'join_approved', roomCode, entityId: uid });
  state.invalidate();
  return { ok: true };
}

export async function rejectJoinRequest(db, state, { roomCode, uid }) {
  await db.update(`rooms/${roomCode}/pendingRequests/${uid}`, {
    status: 'rejected',
    respondedAt: Date.now(),
  });
  await audit(db, { action: 'join_rejected', roomCode, entityId: uid });
  state.invalidate();
  return { ok: true };
}

export async function removeMember(db, state, { roomCode, uid, reason }) {
  const snapshot = db.snapshot();
  const member = snapshot.rooms?.[roomCode]?.members?.[uid];
  if (!member) throw new Error('החבר לא נמצא בחדר');
  if (snapshot.rooms?.[roomCode]?.metadata?.adminId === uid) {
    throw new Error('אי אפשר להסיר את מנהל החדר. יש להעביר ניהול קודם.');
  }

  await db.update(`rooms/${roomCode}/members/${uid}`, { status: 'removed' });
  await db.remove(`users/${uid}/rooms/${roomCode}`);
  await audit(db, {
    action: 'member_removed',
    roomCode,
    entityId: uid,
    detail: reason ?? null,
    previous: member,
  });
  state.invalidate();
  return { ok: true };
}

export async function transferAdmin(db, state, { roomCode, uid }) {
  const snapshot = db.snapshot();
  const member = snapshot.rooms?.[roomCode]?.members?.[uid];
  if (!member || member.status !== 'active') throw new Error('היעד אינו חבר פעיל בחדר');
  const previous = snapshot.rooms?.[roomCode]?.metadata?.adminId ?? null;

  await db.update(`rooms/${roomCode}/metadata`, { adminId: uid });
  await db.update(`rooms/${roomCode}/members/${uid}`, { role: 'admin' });
  if (previous && previous !== uid) {
    await db.update(`rooms/${roomCode}/members/${previous}`, { role: 'member' });
  }
  await db.update(`roomCodes/${roomCode}`, { adminId: uid });
  await audit(db, { action: 'admin_transferred', roomCode, entityId: uid, previous: { adminId: previous } });
  state.invalidate();
  return { ok: true };
}

/**
 * השעיית משתמש — האפליקציה חוסמת כניסה כשהדגל דלוק (חוזה מתועד
 * ב-docs/13-admin-console.md).
 *
 * ‼️ הדגל יושב ב-suspensions/{uid} ולא בתוך users/{uid}: הלקוח כותב את
 *    users/{uid} ב-set מלא בהרשמה, וכתיבה כזו הייתה מוחקת דגל שיושב
 *    באותו אובייקט — כלומר המושעה היה משחרר את עצמו בלי לדעת.
 */
export async function suspendUser(db, state, { uid, suspended, reason }) {
  await db.set(`suspensions/${uid}`, suspended ? { at: Date.now(), reason: reason ?? null } : null);
  await db.set(`${CONSOLE}/suspensions/${uid}`, suspended ? { at: Date.now(), reason: reason ?? null } : null);
  await audit(db, {
    action: suspended ? 'user_suspended' : 'user_unsuspended',
    entityId: uid,
    detail: reason ?? null,
  });
  state.invalidate();
  return { ok: true };
}

/* ═══════════ חדרים ═══════════ */

export async function archiveRoom(db, state, { roomCode, reason }) {
  const backupId = await backup(db, `rooms/${roomCode}`, `ארכוב חדר ${roomCode}`);
  await db.update(`rooms/${roomCode}/metadata`, { archivedAt: Date.now() });
  await db.set(`${CONSOLE}/archivedRooms/${roomCode}`, {
    at: Date.now(),
    reason: reason ?? null,
    backupId,
  });
  await audit(db, { action: 'room_archived', roomCode, detail: reason ?? null, backupId });
  state.invalidate();
  return { ok: true, backupId };
}

export async function unarchiveRoom(db, state, { roomCode }) {
  await db.remove(`rooms/${roomCode}/metadata/archivedAt`);
  await db.remove(`${CONSOLE}/archivedRooms/${roomCode}`);
  await audit(db, { action: 'room_unarchived', roomCode });
  state.invalidate();
  return { ok: true };
}

/**
 * איפוס מאזנים — מסמן את כל הקניות המאושרות כ-settled.
 *
 * ‼️ לא מוחק כלום. הקניות נשארות ביומן; מה שמשתנה הוא שהן כבר לא
 *    נספרות במאזן. זו הדרך היחידה שבה "התחלנו מחדש" לא הופך גם ל
 *    "אין לנו מושג מה קרה קודם".
 */
export async function resetBalances(db, state, { roomCode, reason }) {
  const backupId = await backup(db, `rooms/${roomCode}/purchases`, `איפוס מאזנים ${roomCode}`);
  const snapshot = db.snapshot();
  const purchases = snapshot.rooms?.[roomCode]?.purchases ?? {};

  let count = 0;
  for (const [pid, p] of Object.entries(purchases)) {
    if (p.status === 'approved') {
      await db.update(`rooms/${roomCode}/purchases/${pid}`, { status: 'settled' });
      count++;
    }
  }
  await recomputeBalances(db, state, roomCode);
  await audit(db, {
    action: 'balances_reset',
    roomCode,
    detail: `${count} קניות סומנו כסגורות. ${reason ?? ''}`.trim(),
    backupId,
  });
  return { ok: true, settled: count, backupId };
}

/** סנכרון כפוי — חישוב מחדש של כל הנתונים הנגזרים בחדר. */
export async function forceSync(db, state, { roomCode }) {
  const balances = await recomputeBalances(db, state, roomCode);
  await audit(db, { action: 'force_sync', roomCode });
  return { ok: true, balances };
}

/* ═══════════ שידור לחדר ═══════════ */

export async function announceToRoom(db, state, { roomCode, text }) {
  const snapshot = db.snapshot();
  const adminId = snapshot.rooms?.[roomCode]?.metadata?.adminId;
  const id = await db.push(`rooms/${roomCode}/announcements`, {
    senderId: adminId ?? 'admin-console',
    text,
    sentAt: Date.now(),
    fromSystemAdmin: true,
  });
  await audit(db, { action: 'room_announcement', roomCode, entityId: id, detail: text });
  state.invalidate();
  return { ok: true, id };
}

export { audit, backup };
