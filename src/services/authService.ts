import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { ref, serverTimestamp, set, update } from 'firebase/database';
import { auth, db } from '../config/firebase';
import { clearAllCache } from '../lib/cache';
import { clearPrefs } from '../lib/prefs';
import { assertOnline } from './guard';

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

export const subscribeToAuth = (cb: (u: User | null) => void) => onAuthStateChanged(auth, cb);
