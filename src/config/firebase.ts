import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

/**
 * שימו לב: apiKey של Firebase אינו סוד. הוא מזהה פרויקט ציבורי שנועד
 * להיחשף בקוד צד-לקוח. מה שמגן על הנתונים הוא Security Rules בלבד.
 * ראו docs/02-firebase-setup.md
 */
const env = import.meta.env;

const REQUIRED = [
  'VITE_FB_API_KEY',
  'VITE_FB_AUTH_DOMAIN',
  'VITE_FB_DATABASE_URL',
  'VITE_FB_PROJECT_ID',
  'VITE_FB_APP_ID',
] as const;

export const missingConfigKeys = REQUIRED.filter((k) => !env[k]);

/** האם הוגדרו כל משתני הסביבה הנדרשים. */
export const isFirebaseConfigured = missingConfigKeys.length === 0;

/**
 * ערכי מציין מקום כשאין קונפיגורציה. הם מאפשרים ל-SDK לאתחל בלי לזרוק,
 * כך שהאפליקציה מציגה מסך הסבר ידידותי במקום מסך לבן.
 * שום קריאת רשת לא יוצאת אליהם — הראוטר כלל לא נטען במצב הזה.
 */
const firebaseConfig = {
  apiKey: env.VITE_FB_API_KEY ?? 'not-configured',
  authDomain: env.VITE_FB_AUTH_DOMAIN ?? 'not-configured.firebaseapp.com',
  databaseURL: env.VITE_FB_DATABASE_URL ?? 'https://not-configured-default-rtdb.firebaseio.com',
  projectId: env.VITE_FB_PROJECT_ID ?? 'not-configured',
  storageBucket: env.VITE_FB_STORAGE_BUCKET ?? 'not-configured.appspot.com',
  messagingSenderId: env.VITE_FB_MSG_SENDER_ID ?? '000000000000',
  appId: env.VITE_FB_APP_ID ?? '1:000000000000:web:0000000000000000000000',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);

if (isFirebaseConfigured && env.VITE_USE_EMULATORS === 'true') {
  // 127.0.0.1 ולא localhost — localhost נפתר ל-IPv6 בחלק מהסביבות
  // בעוד האמולטור מאזין ל-IPv4 בלבד.
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  console.info('🔧 מחובר לאמולטורים המקומיים');
}

if (!isFirebaseConfigured) {
  console.warn(
    '⚠️ Firebase לא מוגדר. משתני סביבה חסרים:',
    missingConfigKeys.join(', '),
    '\n   העתיקו את .env.example ל-.env.local ומלאו את הערכים.'
  );
}
