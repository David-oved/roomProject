import { get, push, ref, runTransaction, serverTimestamp, update } from 'firebase/database';
import { db } from '../config/firebase';
import { generateRoomCode, slugifyRoomName } from '../lib/roomCode';
import { assertOnline } from './guard';
import { staplesMap } from './catalogService';
import { enqueueNotification } from './outboxService';
import { computeBalances } from '../lib/money';
import type { Category, JoinRequest, Purchase, Settlement, UserProfile } from '../types/models';

export class RoomNameTakenError extends Error {
  constructor(name: string) {
    super(`כבר קיים חדר בשם "${name}". בחרו שם אחר.`);
    this.name = 'RoomNameTakenError';
  }
}

export interface RoomDraft {
  name: string;
  description?: string;
  categories: Category[];
  /** מזהי מוצרי הבסיס שנבחרו בקטלוג */
  staples?: string[];
}

/**
 * יצירת חדר.
 *
 * הפונקציה המורכבת ביותר באפליקציה — היא חייבת להיות אטומית בשני
 * מימדים: קוד ייחודי ושם ייחודי. בדיקת "קראתי, לא קיים, אז אכתוב"
 * היא Race Condition; לכן השם נתפס ב-runTransaction.
 */
export async function createRoom(
  userId: string,
  profile: UserProfile,
  draft: RoomDraft
): Promise<string> {
  assertOnline('ליצור חדר');

  const slug = slugifyRoomName(draft.name);
  if (slug.length < 2) throw new Error('שם החדר קצר מדי');

  // ── 1) קוד ייחודי ──
  let code = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateRoomCode();
    const snap = await get(ref(db, `roomCodes/${candidate}`));
    if (!snap.exists()) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new Error('לא הצלחנו ליצור קוד חדר. נסו שוב.');

  // ── 2) תפיסת השם, אטומית ──
  //
  // לפני התפיסה בודקים אם השם "יתום": תפוס ע"י קוד חדר שאינו קיים.
  // זה קורה כשיצירת חדר נכשלה אחרי תפיסת השם ולפני יצירת החדר עצמו.
  // בלי הבדיקה הזו השם נשאר חסום לנצח ואי אפשר להשתמש בו שוב.
  const nameRef = ref(db, `roomNames/${slug}`);
  let orphanCode: string | null = null;

  const held = await get(nameRef);
  if (held.exists()) {
    const heldBy = String(held.val());
    // roomCodes הוא האינדקס הציבורי — ניתן לקריאה גם למי שאינו חבר,
    // בניגוד ל-/rooms עצמו. לכן הוא הדרך היחידה לבדוק אם החדר קיים.
    const codeSnap = await get(ref(db, `roomCodes/${heldBy}`));
    if (codeSnap.exists()) throw new RoomNameTakenError(draft.name);
    orphanCode = heldBy;
  }

  const result = await runTransaction(nameRef, (current: string | null) =>
    current === null || current === orphanCode ? code : undefined
  );
  if (!result.committed) throw new RoomNameTakenError(draft.name);

  // ── 3) יצירת החדר בכתיבה אטומית אחת ──
  const categories = Object.fromEntries(draft.categories.map((c) => [c, true]));

  try {
    await update(ref(db), {
      [`roomCodes/${code}`]: {
        name: draft.name.trim(),
        adminId: userId,
        createdAt: serverTimestamp(),
      },
      [`rooms/${code}/metadata`]: {
        name: draft.name.trim(),
        description: draft.description?.trim() ?? '',
        photo: null,
        categories,
        currency: 'ILS',
        createdAt: serverTimestamp(),
        createdBy: userId,
        adminId: userId,
      },
      [`rooms/${code}/members/${userId}`]: {
        name: profile.displayName,
        email: profile.email,
        avatar: profile.avatar ?? null,
        joinedAt: serverTimestamp(),
        status: 'active',
        role: 'admin',
      },
      [`users/${userId}/rooms/${code}`]: true,
      // מוצרי הבסיס נכתבים באותה פעולה אטומית — חדר בלי הבסיס שלו
      // הוא חדר חצי-מוגדר, ואין סיבה שיהיה מצב ביניים כזה.
      ...(draft.staples?.length
        ? { [`rooms/${code}/staples`]: staplesMap(draft.staples) }
        : {}),
    });
  } catch (err) {
    // ── 4) פיצוי: משחררים את השם, אחרת הוא נשאר "תפוס" לנצח ──
    //
    // ‼️ עטוף ב-try משלו. אם גם השחרור נכשל, הוא היה זורק שגיאה
    // חדשה שמחליפה את המקורית — והמשתמש היה מקבל הודעה על תקלה
    // אחרת לגמרי מזו שבאמת קרתה. קרה בפועל.
    try {
      await runTransaction(nameRef, (cur: string | null) => (cur === code ? null : cur));
    } catch {
      // השם יישאר יתום, אבל הבדיקה בסעיף 2 תשחרר אותו בניסיון הבא
    }
    throw err;
  }

  return code;
}

/** בדיקה אם קוד חדר קיים. מחזירה את שם החדר ומזהה המנהל, או null. */
export async function lookupRoom(code: string): Promise<{ name: string; adminId: string } | null> {
  const snap = await get(ref(db, `roomCodes/${code}`));
  if (!snap.exists()) return null;
  const val = snap.val() as { name: string; adminId: string };
  return { name: val.name, adminId: val.adminId };
}

export async function requestToJoin(
  code: string,
  userId: string,
  profile: UserProfile
): Promise<string> {
  assertOnline('לשלוח בקשת הצטרפות');

  if (profile.rooms?.[code]) throw new Error('אתם כבר חברים בחדר הזה.');

  const room = await lookupRoom(code);
  if (!room) throw new Error('קוד החדר אינו קיים. בדקו את הקוד ונסו שוב.');

  await update(ref(db), {
    [`rooms/${code}/pendingRequests/${userId}`]: {
      userId,
      displayName: profile.displayName,
      email: profile.email,
      avatar: profile.avatar ?? null,
      requestedAt: serverTimestamp(),
      status: 'pending',
      respondedAt: null,
    },
    [`joinRequests/${userId}/${code}`]: {
      status: 'pending',
      requestedAt: serverTimestamp(),
      respondedAt: null,
      roomName: room.name,
    },
  });

  /**
   * המבקש עדיין לא חבר בחדר, ולכן לא יכול לכתוב התראת 'room' רגילה —
   * חוקי ה-outbox מתירים לו חריג צר: להודיע אך ורק למנהל האמיתי של
   * החדר הזה, ואך ורק כשהבקשה שלו אכן קיימת ו-pending. ראו database.rules.json.
   */
  void enqueueNotification({
    roomCode: code,
    title: 'בקשת הצטרפות חדשה',
    body: `${profile.displayName} מבקש/ת להצטרף ל${room.name}`,
    url: `/r/${code}/settings/members`,
    tag: `join-request-${userId}`,
    priority: 'now',
    audience: 'user',
    targetUid: room.adminId,
    actorUid: userId,
  });

  return room.name;
}

export async function cancelJoinRequest(code: string, userId: string): Promise<void> {
  assertOnline('לבטל בקשה');
  await update(ref(db), {
    [`rooms/${code}/pendingRequests/${userId}`]: null,
    [`joinRequests/${userId}/${code}`]: null,
  });
}

export async function approveJoinRequest(
  code: string,
  adminId: string,
  adminName: string,
  request: JoinRequest
): Promise<void> {
  assertOnline('לאשר בקשה');

  const notifId = push(ref(db, `rooms/${code}/notifications`)).key!;

  // שש כתיבות, פעולה אטומית אחת. אין מצב ביניים שבו המשתמש חבר בחדר
  // אבל הבקשה שלו עדיין "ממתינה".
  await update(ref(db), {
    [`rooms/${code}/members/${request.userId}`]: {
      name: request.displayName,
      email: request.email,
      avatar: request.avatar ?? null,
      joinedAt: serverTimestamp(),
      status: 'active',
      role: 'member',
    },
    [`rooms/${code}/pendingRequests/${request.userId}/status`]: 'approved',
    [`rooms/${code}/pendingRequests/${request.userId}/respondedAt`]: serverTimestamp(),
    [`joinRequests/${request.userId}/${code}/status`]: 'approved',
    [`joinRequests/${request.userId}/${code}/respondedAt`]: serverTimestamp(),
    [`users/${request.userId}/rooms/${code}`]: true,
    [`rooms/${code}/notifications/${notifId}`]: {
      type: 'member_joined',
      actorId: adminId,
      actorName: adminName,
      text: `${request.displayName} הצטרף לחדר`,
      entityId: request.userId,
      createdAt: serverTimestamp(),
      readBy: { [adminId]: true },
    },
  });

  // המצטרף ממתין לאישור הזה — זו ההתראה החשובה ביותר באפליקציה
  void enqueueNotification({
    roomCode: code,
    title: 'הבקשה שלך אושרה',
    body: 'ברוכים הבאים לחדר',
    url: `/r/${code}`,
    tag: `join-${code}`,
    priority: 'now',
    audience: 'user',
    targetUid: request.userId,
    actorUid: adminId,
  });
}

export async function rejectJoinRequest(
  code: string,
  adminId: string,
  requestUserId: string
): Promise<void> {
  assertOnline('לדחות בקשה');
  await update(ref(db), {
    [`rooms/${code}/pendingRequests/${requestUserId}/status`]: 'rejected',
    [`rooms/${code}/pendingRequests/${requestUserId}/respondedAt`]: serverTimestamp(),
    [`joinRequests/${requestUserId}/${code}/status`]: 'rejected',
    [`joinRequests/${requestUserId}/${code}/respondedAt`]: serverTimestamp(),
  });

  void enqueueNotification({
    roomCode: code,
    title: 'הבקשה שלך נדחתה',
    body: 'הבקשה שלך להצטרף לחדר לא אושרה על ידי מנהל החדר',
    url: '/onboarding',
    tag: `join-${code}`,
    priority: 'now',
    audience: 'user',
    targetUid: requestUserId,
    actorUid: adminId,
  });
}

export async function removeMember(
  code: string,
  adminId: string,
  adminName: string,
  memberId: string,
  memberName: string
): Promise<void> {
  assertOnline('להסיר חבר');

  const notifId = push(ref(db, `rooms/${code}/notifications`)).key!;

  // ‼️ status: 'removed' ולא מחיקה — אחרת כל הקניות שלו מאבדות הקשר
  // והמאזנים של כל השאר משתנים רטרואקטיבית.
  await update(ref(db), {
    [`rooms/${code}/members/${memberId}/status`]: 'removed',
    [`users/${memberId}/rooms/${code}`]: null,
    // ‼️ ניקוי המראה האישית והבקשה. בלעדיו הן נשארות 'approved' לנצח,
    // ומסך ההמתנה ינווט את המשתמש חזרה לחדר שהוא כבר לא חבר בו.
    [`joinRequests/${memberId}/${code}`]: null,
    [`rooms/${code}/pendingRequests/${memberId}`]: null,
    [`rooms/${code}/notifications/${notifId}`]: {
      type: 'member_removed',
      actorId: adminId,
      actorName: adminName,
      text: `${memberName} הוסר מהחדר`,
      entityId: memberId,
      createdAt: serverTimestamp(),
      readBy: { [adminId]: true },
    },
  });

  void enqueueNotification({
    roomCode: code,
    title: 'הוסרת מהחדר',
    body: 'הוסרת מהחדר על ידי מנהל החדר',
    url: '/onboarding',
    tag: `removed-${code}`,
    priority: 'now',
    audience: 'user',
    targetUid: memberId,
    actorUid: adminId,
  });
}

export async function leaveRoom(code: string, userId: string): Promise<void> {
  assertOnline('לעזוב את החדר');
  await update(ref(db), {
    [`rooms/${code}/members/${userId}/status`]: 'removed',
    [`users/${userId}/rooms/${code}`]: null,
    // כמו ב-removeMember: מנקים את המראה כדי שלא תיווצר לולאת ניתוב
    [`joinRequests/${userId}/${code}`]: null,
    [`rooms/${code}/pendingRequests/${userId}`]: null,
  });
}

/**
 * עדכון פרטי חדר. שינוי שם דורש להעביר את תפיסת roomNames לשם החדש —
 * בלעדיו: (א) ייחודיות השם מפסיקה להיאכף על השם החדש, ו-(ב) השם הישן
 * נשאר תפוס לנצח (עד שמישהו ינסה להשתמש בו ומפעיל את מנגנון היתומים).
 * נתפס בדיוק כמו ביצירת חדר, כולל טיפול בשם יתום — ראו createRoom.
 */
export async function updateRoomMetadata(
  code: string,
  currentName: string,
  patch: { name?: string; description?: string }
): Promise<void> {
  assertOnline('לעדכן את החדר');

  const updates: Record<string, unknown> = {};
  let oldSlug: string | null = null;
  let newSlug: string | null = null;

  if (patch.name !== undefined) {
    const newName = patch.name.trim();
    oldSlug = slugifyRoomName(currentName);
    newSlug = slugifyRoomName(newName);

    if (newSlug.length < 2) throw new Error('שם החדר קצר מדי');

    if (newSlug !== oldSlug) {
      const newSlugRef = ref(db, `roomNames/${newSlug}`);
      let orphanCode: string | null = null;

      const held = await get(newSlugRef);
      if (held.exists() && String(held.val()) !== code) {
        const heldBy = String(held.val());
        const codeSnap = await get(ref(db, `roomCodes/${heldBy}`));
        if (codeSnap.exists()) throw new RoomNameTakenError(newName);
        orphanCode = heldBy;
      }

      const result = await runTransaction(newSlugRef, (current: string | null) =>
        current === null || current === orphanCode || current === code ? code : undefined
      );
      if (!result.committed) throw new RoomNameTakenError(newName);

      updates[`roomNames/${oldSlug}`] = null;
    } else {
      // אותו slug (שינוי ניקוד/רווחים בלבד) — אין מה להעביר
      oldSlug = null;
      newSlug = null;
    }

    updates[`rooms/${code}/metadata/name`] = newName;
    updates[`roomCodes/${code}/name`] = newName;
  }

  if (patch.description !== undefined) {
    updates[`rooms/${code}/metadata/description`] = patch.description.trim();
  }

  try {
    await update(ref(db), updates);
  } catch (err) {
    // פיצוי: אם תפסנו slug חדש אבל שאר הכתיבה נכשלה, לשחרר אותו —
    // עטוף בנפרד כדי לא להסתיר את השגיאה המקורית (ראו createRoom).
    if (newSlug) {
      try {
        await runTransaction(ref(db, `roomNames/${newSlug}`), (cur: string | null) =>
          cur === code ? null : cur
        );
      } catch {
        /* יישאר יתום, יתפנה בפעם הבאה שמישהו ינסה את השם */
      }
    }
    throw err;
  }
}

/**
 * מחיקת חדר — בלתי הפיכה.
 *
 * ⚠️ אין גיבוי אוטומטי ב-RTDB בתוכנית החינמית. הגנת השכבה השנייה
 * (חסימה על מאזן פתוח) נאכפת בממשק, ראו RoomSettingsPage.
 */
export async function deleteRoom(
  code: string,
  memberIds: string[],
  nameSlug: string
): Promise<void> {
  assertOnline('למחוק את החדר');

  const updates: Record<string, unknown> = {
    [`rooms/${code}`]: null,
    [`roomCodes/${code}`]: null,
    [`roomNames/${nameSlug}`]: null,
  };
  for (const uid of memberIds) {
    updates[`users/${uid}/rooms/${code}`] = null;
  }

  await update(ref(db), updates);
}

/** ייצוא כל תוכן החדר כ-JSON, לגיבוי לפני מחיקה. */
export async function exportRoom(code: string): Promise<string> {
  const snap = await get(ref(db, `rooms/${code}`));
  return JSON.stringify(snap.val(), null, 2);
}

/**
 * העברת ניהול חדר.
 * ‼️ roomCodes/{code}/adminId חייב להתעדכן גם — אחרת המנהל הישן נשאר
 * עם הרשאת כתיבה על האינדקס הציבורי.
 */
export async function transferAdmin(code: string, from: string, to: string): Promise<void> {
  assertOnline('להעביר ניהול');
  await update(ref(db), {
    [`rooms/${code}/metadata/adminId`]: to,
    [`rooms/${code}/members/${to}/role`]: 'admin',
    [`rooms/${code}/members/${from}/role`]: 'member',
    [`roomCodes/${code}/adminId`]: to,
  });

  void enqueueNotification({
    roomCode: code,
    title: 'אתם עכשיו מנהלי החדר',
    body: 'ניהול החדר הועבר אליכם — אתם מאשרים כעת בקשות הצטרפות וחברים חדשים',
    url: `/r/${code}/settings/members`,
    tag: `admin-${code}`,
    priority: 'now',
    audience: 'user',
    targetUid: to,
    actorUid: from,
  });
}

/**
 * בודקת שאפשר למחוק את החשבון בבטחה — בלי לגעת בכלום.
 *
 * שתי סיבות לחסום:
 *  1. חוב פתוח בחדר כלשהו — מחיקת החשבון לא יכולה למחוק חוב אמיתי.
 *  2. ניהול חדר — חדר בלי מנהל הוא חדר תקוע. חייבים להעביר ניהול
 *     או למחוק את החדר קודם, בדיוק כמו שדורשים לפני מחיקת חדר.
 */
export async function checkAccountDeletable(
  uid: string,
  rooms: Record<string, true> | undefined
): Promise<{ ok: true } | { ok: false; reason: string }> {
  for (const code of Object.keys(rooms ?? {})) {
    const [metaSnap, membersSnap, purchasesSnap, settlementsSnap] = await Promise.all([
      get(ref(db, `rooms/${code}/metadata`)),
      get(ref(db, `rooms/${code}/members`)),
      get(ref(db, `rooms/${code}/purchases`)),
      get(ref(db, `rooms/${code}/settlements`)),
    ]);
    if (!metaSnap.exists()) continue; // חדר שכבר נמחק — לא רלוונטי

    const meta = metaSnap.val() as { name: string; adminId: string };
    if (meta.adminId === uid) {
      return { ok: false, reason: `אתם מנהלי החדר "${meta.name}" — העבירו ניהול או מחקו את החדר קודם` };
    }

    const members = (membersSnap.val() ?? {}) as Record<string, { status: string }>;
    const memberIds = Object.keys(members);
    const purchases = Object.values((purchasesSnap.val() ?? {}) as Record<string, Purchase>);
    const settlements = Object.values((settlementsSnap.val() ?? {}) as Record<string, Settlement>);
    const balance = computeBalances(purchases, settlements, memberIds)[uid] ?? 0;

    if (balance !== 0) {
      const reason =
        balance > 0
          ? `מגיע לכם כסף בחדר "${meta.name}" — סגרו את החשבון קודם`
          : `יש לכם חוב פתוח בחדר "${meta.name}" — סגרו אותו קודם`;
      return { ok: false, reason };
    }
  }

  return { ok: true };
}

/** עוזב את כל החדרים שהמשתמש חבר בהם — צעד הכנה למחיקת חשבון. */
export async function leaveAllRooms(
  uid: string,
  rooms: Record<string, true> | undefined
): Promise<void> {
  const updates: Record<string, unknown> = {};
  for (const code of Object.keys(rooms ?? {})) {
    updates[`rooms/${code}/members/${uid}/status`] = 'removed';
    updates[`users/${uid}/rooms/${code}`] = null;
    updates[`joinRequests/${uid}/${code}`] = null;
    updates[`rooms/${code}/pendingRequests/${uid}`] = null;
  }
  if (Object.keys(updates).length > 0) await update(ref(db), updates);
}
