import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { get, ref, remove, serverTimestamp, set, update } from 'firebase/database';
import { auth, db } from '../config/firebase';
import { clearAllCache } from '../lib/cache';
import { clearPrefs } from '../lib/prefs';
import { unsubscribeFromPush } from './pushService';
import { assertOnline } from './guard';
import { checkAccountDeletable, leaveAllRooms } from './roomService';

const AUTH_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'כתובת האימייל הזו כבר רשומה במערכת.',
  'auth/invalid-email': 'כתובת אימייל לא תקינה',
  'auth/weak-password': 'הסיסמה חייבת להכיל לפחות 6 תווים',
  'auth/missing-password': 'חובה להזין סיסמה',
  // ‼️ אותה הודעה בכוונה — כדי לא לחשוף אילו אימיילים רשומים במערכת
  'auth/user-not-found': 'האימייל או הסיסמה שגויים',
  'auth/wrong-password': 'האימייל או הסיסמה שגויים',
  'auth/invalid-credential': 'האימייל או הסיסמה שגויים',
  'auth/too-many-requests': 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות',
  'auth/network-request-failed': 'אין חיבור לאינטרנט',
  'auth/operation-not-allowed': 'ההרשמה אינה זמינה כרגע. נסו שוב מאוחר יותר.',
};

export function authErrorCode(err: unknown): string {
  return (err as { code?: string })?.code ?? '';
}

export function authErrorMessage(err: unknown): string {
  const code = authErrorCode(err);
  // תקלת תצורה — למשתמש אין מה לעשות עם הפרטים, למפתח כן
  if (code === 'auth/operation-not-allowed' && import.meta.env.DEV) {
    console.error('⚠️ ספק Email/Password כבוי ב-Firebase Console');
  }
  return AUTH_MESSAGES[code] ?? (err as Error)?.message ?? 'אירעה שגיאה. נסו שוב.';
}

/**
 * ‼️ דגל תנאי-מרוץ.
 *
 * createUserWithEmailAndPassword מפעיל את onAuthStateChanged **מיד**,
 * לפני שהספקנו לכתוב את הפרופיל ל-RTDB. AuthContext ראה פרופיל חסר,
 * הפעיל את מנגנון הריפוי העצמי, וכתב displayName: 'משתמש' — שדרס את
 * השם שהמשתמש הקליד בהרשמה.
 *
 * הדגל אומר ל-AuthContext "אל תתערב, ההרשמה כבר מטפלת בזה".
 */
let registrationInProgress = false;
export const isRegistrationInProgress = () => registrationInProgress;

export async function register(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  assertOnline('להירשם');

  const name = displayName.trim();
  registrationInProgress = true;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name });

    // Authentication ו-Realtime Database הן שתי מערכות נפרדות.
    // בלי הכתיבה הזו נוצר משתמש "יתום" שיכול להתחבר אבל אין לו פרופיל.
    await set(ref(db, `users/${cred.user.uid}`), {
      email: email.trim(),
      displayName: name,
      avatar: null,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    });

    return cred.user;
  } finally {
    registrationInProgress = false;
  }
}

export async function login(email: string, password: string): Promise<User> {
  assertOnline('להתחבר');
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  void update(ref(db, `users/${cred.user.uid}`), { lastActiveAt: serverTimestamp() });
  return cred.user;
}

export async function logout(): Promise<void> {
  /**
   * ‼️ ביטול המנוי לפוש לפני הכל.
   *
   * המנוי שמור תחת users/{uid}, אבל ה-endpoint שייך למכשיר. בלי
   * הביטול, משתמש שיתחבר אחר כך באותו מכשיר יקבל את ההתראות של
   * הקודם — במעונות, שם מכשיר עובר בין אנשים, זו דליפה ממשית.
   */
  const uid = auth.currentUser?.uid;
  if (uid) await unsubscribeFromPush(uid).catch(() => undefined);

  await clearAllCache(); // 🔒 לפני ההתנתקות
  clearPrefs();
  await signOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  assertOnline('לשלוח מייל איפוס');
  await sendPasswordResetEmail(auth, email.trim());
}

export async function changeDisplayName(
  userId: string,
  newName: string,
  rooms: Record<string, true> | undefined
): Promise<void> {
  assertOnline('לעדכן שם');
  const name = newName.trim();

  // fan-out: השם משוכפל בכל חדר שהמשתמש חבר בו (ראו docs/01-architecture.md)
  const updates: Record<string, unknown> = { [`users/${userId}/displayName`]: name };
  for (const code of Object.keys(rooms ?? {})) {
    updates[`rooms/${code}/members/${userId}/name`] = name;
  }

  await update(ref(db), updates); // הכל או כלום
  if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: name });
}

/**
 * שינוי סיסמה. Firebase דורש "התחברות טרייה" לפעולה הזו — סשן ישן
 * נכשל עם auth/requires-recent-login. לכן קודם מאמתים מחדש עם הסיסמה
 * הנוכחית, ורק אז מחליפים.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  assertOnline('לשנות סיסמה');
  const user = auth.currentUser;
  if (!user?.email) throw new Error('יש להתחבר מחדש כדי לשנות סיסמה');

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

/**
 * מחיקת חשבון — בלתי הפיכה.
 *
 * סדר הפעולות חשוב: קודם בודקים שאפשר בכלל (בלי לגעת בכלום), אחר כך
 * עוזבים חדרים ומוחקים את הפרופיל, ורק בסוף מוחקים את משתמש ה-Auth —
 * כי ברגע שזה קורה אין יותר הרשאה לכתוב ל-RTDB בכלל.
 */
export async function deleteAccount(currentPassword: string): Promise<void> {
  assertOnline('למחוק חשבון');
  const user = auth.currentUser;
  if (!user?.email) throw new Error('יש להתחבר מחדש כדי למחוק את החשבון');

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);

  const roomsSnap = await get(ref(db, `users/${user.uid}/rooms`));
  const rooms = (roomsSnap.val() ?? undefined) as Record<string, true> | undefined;

  const check = await checkAccountDeletable(user.uid, rooms);
  if (!check.ok) throw new Error(check.reason);

  await leaveAllRooms(user.uid, rooms);
  await unsubscribeFromPush(user.uid).catch(() => undefined);
  await remove(ref(db, `users/${user.uid}`));

  await deleteUser(user);
  await clearAllCache();
  clearPrefs();
}

export const subscribeToAuth = (cb: (u: User | null) => void) => onAuthStateChanged(auth, cb);
