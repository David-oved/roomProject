import { get, push, ref, runTransaction, serverTimestamp, update } from 'firebase/database';
import { db } from '../config/firebase';
import { generateRoomCode, slugifyRoomName } from '../lib/roomCode';
import { assertOnline } from './guard';
import type { Category, JoinRequest, UserProfile } from '../types/models';

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
  const nameRef = ref(db, `roomNames/${slug}`);
  const result = await runTransaction(nameRef, (current: string | null) =>
    current === null ? code : undefined // undefined = ביטול, השם תפוס
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
    });
  } catch (err) {
    // ── 4) פיצוי: משחררים את השם, אחרת הוא נשאר "תפוס" לנצח ──
    await runTransaction(nameRef, (cur: string | null) => (cur === code ? null : cur));
    throw err;
  }

  return code;
}

/** בדיקה אם קוד חדר קיים. מחזירה את שם החדר, או null. */
export async function lookupRoom(code: string): Promise<{ name: string } | null> {
  const snap = await get(ref(db, `roomCodes/${code}`));
  if (!snap.exists()) return null;
  return { name: (snap.val() as { name: string }).name };
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
}

export async function rejectJoinRequest(code: string, requestUserId: string): Promise<void> {
  assertOnline('לדחות בקשה');
  await update(ref(db), {
    [`rooms/${code}/pendingRequests/${requestUserId}/status`]: 'rejected',
    [`rooms/${code}/pendingRequests/${requestUserId}/respondedAt`]: serverTimestamp(),
    [`joinRequests/${requestUserId}/${code}/status`]: 'rejected',
    [`joinRequests/${requestUserId}/${code}/respondedAt`]: serverTimestamp(),
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

export async function updateRoomMetadata(
  code: string,
  patch: { name?: string; description?: string }
): Promise<void> {
  assertOnline('לעדכן את החדר');

  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    updates[`rooms/${code}/metadata/name`] = patch.name.trim();
    updates[`roomCodes/${code}/name`] = patch.name.trim();
  }
  if (patch.description !== undefined) {
    updates[`rooms/${code}/metadata/description`] = patch.description.trim();
  }

  await update(ref(db), updates);
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
}
