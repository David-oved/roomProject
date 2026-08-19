import { buildPushPayload } from '@block65/webcrypto-web-push';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  נקודת קצה לשליחת התראות מיידיות
 * ═══════════════════════════════════════════════════════════════════
 *
 *  הבעיה שהיא פותרת: שליחת Web Push דורשת מפתח VAPID פרטי. מפתח
 *  שיושב בקוד צד-לקוח הוא מפתח דלוף — כל אחד יוכל לשלוח התראות לכל
 *  המשתמשים. לכן חייב להיות מקום מחוץ לאפליקציה שמחזיק אותו.
 *
 *  GitHub Actions עושה בדיוק את זה, אבל רץ לפי לוח זמנים — 5 דקות
 *  במקרה הטוב. ה-Worker הזה ער תמיד, ולכן ההתראה יוצאת בשנייה שבה
 *  האירוע קורה.
 *
 *      אפליקציה  ──POST──►  Worker  ──►  שרתי אפל/גוגל  ──►  📱
 *
 *  ‼️ הכתובת ציבורית. בלי אימות, כל אחד היה יכול לשלוח התראות לכל
 *  משתמש במערכת. לכן כל בקשה עוברת שלוש בדיקות:
 *    1. טוקן Firebase תקין וחתום ע"י גוגל
 *    2. הרשומה בתור באמת נוצרה ע"י אותו משתמש
 *    3. הרשומה עדיין לא נשלחה
 *
 *  ה-GitHub Action נשאר כרשת ביטחון: כל התראה שה-Worker לא הספיק
 *  לשלוח נאספת בתוך 5 דקות. שתי שכבות, לא אחת.
 * ═══════════════════════════════════════════════════════════════════
 */

/* ───────────────────── עזרי קידוד ───────────────────── */

const b64urlToBytes = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const bytesToB64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/* ───────────────── אימות טוקן המשתמש ───────────────── */

/** מפתחות ציבוריים של גוגל. נשמרים במטמון — הם מתחלפים אחת לימים. */
let jwksCache = { keys: null, until: 0 };

async function googleJwks() {
  if (jwksCache.keys && Date.now() < jwksCache.until) return jwksCache.keys;

  const res = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) throw new Error('שליפת מפתחות גוגל נכשלה');

  const jwks = await res.json();
  jwksCache = { keys: jwks.keys, until: Date.now() + 60 * 60 * 1000 };
  return jwks.keys;
}

/**
 * מאמת טוקן Firebase ומחזיר את מזהה המשתמש.
 *
 * הבדיקה כוללת את החתימה **וגם** את התוכן. חתימה תקינה לבדה לא
 * מספיקה: טוקן מפרויקט Firebase אחר לגמרי חתום גם הוא ע"י גוגל,
 * ובלי בדיקת aud ו-iss הוא היה מתקבל כאן.
 */
async function verifyIdToken(token, projectId) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('מבנה טוקן שגוי');

  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));

  if (header.alg !== 'RS256') throw new Error('אלגוריתם חתימה לא נתמך');

  const jwk = (await googleJwks()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('מפתח החתימה אינו מוכר');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!ok) throw new Error('חתימת הטוקן אינה תקינה');

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now) throw new Error('הטוקן פג תוקף');
  if (claims.aud !== projectId) throw new Error('הטוקן שייך לפרויקט אחר');
  if (claims.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('מנפיק הטוקן שגוי');
  }
  if (!claims.sub) throw new Error('הטוקן חסר מזהה משתמש');

  return claims.sub;
}

/* ───────────── גישת אדמין למסד הנתונים ───────────── */

let tokenCache = { token: null, until: 0 };

/**
 * מנפיק טוקן גישה של גוגל מתוך ה-service account.
 *
 * נדרש כי מנויי הפוש שמורים תחת users/{uid} וקריאים רק לבעליהם.
 * כדי לשלוח למישהו אחר חייבים לעקוף את כללי האבטחה — וזה בדיוק
 * מה שחשבון שירות עושה.
 */
async function accessToken(env) {
  if (tokenCache.token && Date.now() < tokenCache.until) return tokenCache.token;

  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);

  const jwtHeader = bytesToB64url(
    new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  );
  const jwtClaims = bytesToB64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        scope:
          'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      })
    )
  );

  // המפתח מגיע כ-PEM; Web Crypto מצפה ל-DER גולמי
  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = b64urlToBytes(pem.replace(/\+/g, '-').replace(/\//g, '_'));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${jwtHeader}.${jwtClaims}`)
  );

  const assertion = `${jwtHeader}.${jwtClaims}.${bytesToB64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) throw new Error(`הנפקת טוקן גישה נכשלה: ${await res.text()}`);

  const data = await res.json();
  // דקה מוקדם יותר, כדי לא להשתמש בטוקן שפג בדיוק בזמן הבקשה
  tokenCache = { token: data.access_token, until: Date.now() + (data.expires_in - 60) * 1000 };
  return tokenCache.token;
}

const dbGet = async (env, path) => {
  const token = await accessToken(env);
  const res = await fetch(`${env.FIREBASE_DATABASE_URL}/${path}.json?access_token=${token}`);
  if (!res.ok) throw new Error(`קריאה מ-${path} נכשלה (${res.status})`);
  return res.json();
};

const dbPatch = async (env, path, value) => {
  const token = await accessToken(env);
  await fetch(`${env.FIREBASE_DATABASE_URL}/${path}.json?access_token=${token}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });
};

const dbDelete = async (env, path) => {
  const token = await accessToken(env);
  await fetch(`${env.FIREBASE_DATABASE_URL}/${path}.json?access_token=${token}`, {
    method: 'DELETE',
  });
};

/* ───────────────────── שליחה ───────────────────── */

async function sendToUser(env, uid, payload) {
  const user = await dbGet(env, `users/${uid}`);
  if (!user || user.pushEnabled === false) return 0;

  const subs = Object.entries(user.pushSubscriptions || {});
  if (subs.length === 0) return 0;

  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  let ok = 0;

  await Promise.all(
    subs.map(async ([id, s]) => {
      try {
        const message = { data: payload, options: { ttl: 60 * 60 * 24 } };
        const subscription = {
          endpoint: s.endpoint,
          expirationTime: null,
          keys: { auth: s.auth, p256dh: s.p256dh },
        };

        const req = await buildPushPayload(message, subscription, vapid);
        const res = await fetch(s.endpoint, req);

        if (res.ok) {
          ok++;
        } else if (res.status === 404 || res.status === 410) {
          // המכשיר כבר לא קיים — מנקים, אחרת ננסה לשלוח אליו לנצח
          await dbDelete(env, `users/${uid}/pushSubscriptions/${id}`);
        }
      } catch {
        // כשל בודד לא אמור להפיל את שאר הנמענים
      }
    })
  );

  return ok;
}

/* ───────────────────── נתב ───────────────────── */

const cors = (env) => ({
  'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
});

const json = (env, body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors(env) },
  });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(env) });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json(env, { ok: true, service: 'roommate-push' });
    }

    if (url.pathname !== '/notify' || request.method !== 'POST') {
      return json(env, { error: 'not found' }, 404);
    }

    try {
      const { idToken, entryId } = await request.json();
      if (!idToken || !entryId) return json(env, { error: 'חסרים פרטים' }, 400);

      // ① מי אתה
      //    כשל אימות מוחזר כ-401 ולא כ-500: זו לא תקלה אצלנו אלא
      //    בקשה פסולה, ו-500 היה מעודד את הלקוח לנסות שוב לחינם.
      let uid;
      try {
        uid = await verifyIdToken(idToken, env.FIREBASE_PROJECT_ID);
      } catch {
        return json(env, { error: 'אימות נכשל' }, 401);
      }

      // ② מה ביקשת לשלוח
      const entry = await dbGet(env, `outbox/${entryId}`);
      if (!entry) return json(env, { error: 'הרשומה לא נמצאה' }, 404);

      // ③ זו באמת ההתראה שלך?
      //    בלי הבדיקה הזו, משתמש מאומת אחד היה יכול לשגר כל התראה
      //    בתור, כולל של חדרים שאינו חבר בהם.
      if (entry.excludeUid !== uid) {
        return json(env, { error: 'ההתראה אינה שלך' }, 403);
      }

      // ④ כבר נשלחה? — ה-Action עשוי להקדים אותנו
      if (entry.sentAt) return json(env, { ok: true, alreadySent: true });

      // ⑤ מי הנמענים
      let recipients = [];
      if (entry.audience === 'user') {
        if (entry.targetUid) recipients = [entry.targetUid];
      } else {
        const members = await dbGet(env, `rooms/${entry.roomCode}/members`);
        recipients = Object.entries(members || {})
          .filter(([id, m]) => m?.status === 'active' && id !== entry.excludeUid)
          .map(([id]) => id);
      }

      const payload = {
        title: entry.title,
        body: entry.body,
        url: entry.url || '/',
        tag: entry.tag || 'roommate',
      };

      // ‼️ allSettled ולא all: נמען בודד שנכשל (dbGet תקוע, בעיית רשת
      // חד-פעמית) לא אמור להפיל את כל הבקשה ולמנוע משאר חברי החדר
      // לקבל את ההתראה המיידית — הם עדיין יקבלו אותה מה-GitHub Action
      // תוך 5 דקות, אבל אין סיבה לוותר על המיידיות עבורם רק בגלל אחד.
      const results = await Promise.allSettled(
        recipients.map((r) => sendToUser(env, r, payload))
      );
      const sent = results.reduce((a, r) => a + (r.status === 'fulfilled' ? r.value : 0), 0);

      await dbPatch(env, `outbox/${entryId}`, { sentAt: Date.now() });

      return json(env, { ok: true, recipients: recipients.length, sent });
    } catch (err) {
      // ‼️ לא מחזירים את פרטי השגיאה ללקוח — הם עלולים לחשוף מבנה
      //    פנימי. הפירוט נשאר בלוג של Cloudflare (wrangler tail).
      console.error('notify failed:', err?.message || err);
      return json(env, { error: 'השליחה נכשלה' }, 500);
    }
  },
};
