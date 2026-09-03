/**
 * לקוח ה-API.
 *
 * ═══════════════════════════════════════════════════════════════
 *  איך נראית גישה מאושרת
 * ═══════════════════════════════════════════════════════════════
 *  לא טוקן. **שני חצאים** שחייבים להגיע יחד:
 *
 *   • מזהה הסשן — בעוגייה HttpOnly. הקוד כאן לא רואה אותה ולא יכול,
 *     ולכן באג בממשק אינו יכול להדליף אותה.
 *   • סוד הסשן — ב-localStorage, נשלח בכותרת x-admin-session.
 *
 *  ‼️ למה דווקא החלוקה הזאת: עוגיות ב-localhost אינן מופרדות לפי פורט,
 *     ולכן כל שרת מקומי אחר שגולשים אליו באותו דפדפן מקבל את העוגייה
 *     שלנו. localStorage כן מופרד לפי פורט. כל חצי לבדו חסר ערך.
 *
 *  שני החצאים נוצרים ב-/enter — הכתובת שהמשגר פותח עם כרטיס חד-פעמי.
 *  אין כאן שום מסלול שבו טוקן קבוע נשמר בדפדפן.
 * ═══════════════════════════════════════════════════════════════
 */

/** חייב להתאים ל-SECRET_STORAGE_KEY ב-admin/server/index.mjs. */
const SECRET_KEY = 'rmAdminSessionSecret';

function readSecret(): string {
  try {
    return localStorage.getItem(SECRET_KEY) ?? '';
  } catch {
    return ''; // דפדפן שחוסם אחסון — ייפול על מסך הכניסה, וזה בסדר
  }
}

let secret = readSecret();

export function hasSession() {
  return secret.length > 0;
}

function storeSecret(next: string) {
  secret = next;
  try {
    localStorage.setItem(SECRET_KEY, next);
  } catch {
    /* ללא אחסון הסשן שורד רק את הטאב הנוכחי */
  }
}

function forgetSecret() {
  secret = '';
  try {
    localStorage.removeItem(SECRET_KEY);
  } catch {
    /* אין מה לנקות */
  }
}

/** מחליף את הטוקן הראשי בסשן — מסלול השחזור כשאין כרטיס מהמשגר. */
export async function exchangeToken(token: string) {
  const res = await fetch('/api/session/exchange', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: token.trim() }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `שגיאה ${res.status}`, res.status);
  storeSecret(body.secret);
}

/** נעילה מפורשת: הסשן מת בשרת, והחצי המקומי נמחק. */
export async function lockConsole() {
  try {
    await fetch('/api/session/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    forgetSecret();
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-admin-session': secret,
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    // ‼️ סשן שפג — מוחקים את החצי המקומי מיד. בלי זה הממשק היה ממשיך
    //    לנסות עם סוד מת ולהיראות "תקוע" במקום להציג את מסך הכניסה.
    if (res.status === 401) forgetSecret();

    let message = `שגיאה ${res.status}`;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      /* גוף שאינו JSON — נשארים עם ההודעה הגנרית */
    }
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T,>(path: string, params?: Record<string, string | number | undefined | null>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
    }
    const qs = search.toString();
    return request<T>(qs ? `${path}?${qs}` : path);
  },
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  del: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
  /**
   * קישור ישיר להורדה/הדפסה. הדפדפן מנווט אליו בעצמו ולא דרך fetch,
   * ולכן אי אפשר לקבוע כותרת והסוד נוסע ב-query.
   */
  fileUrl: (path: string, params?: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams({ k: secret });
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
    }
    return `/api${path}?${search.toString()}`;
  },
};

/**
 * דופק חוסר-פעילות.
 *
 * ‼️ נשלח על פעולה אמיתית של המשתמש בלבד (לחיצה, מקש), ולכל היותר
 *    פעם בכמה דקות. טיימר שרץ לבד היה מבטל את כל התכלית: הקונסולה
 *    אמורה להינעל כשקמים מהמחשב, לא כשהטאב פתוח.
 */
export function startKeepAlive(everyMs = 5 * 60 * 1000) {
  let last = Date.now();
  const ping = () => {
    if (!secret || Date.now() - last < everyMs) return;
    last = Date.now();
    void fetch('/api/keepalive', {
      credentials: 'same-origin',
      headers: { 'x-admin-session': secret },
    }).catch(() => {});
  };
  const events: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown'];
  for (const name of events) document.addEventListener(name, ping, { passive: true });
  return () => {
    for (const name of events) document.removeEventListener(name, ping);
  };
}

/**
 * זרם השינויים מהשרת. מחזיר פונקציית ניתוק.
 *
 * ‼️ onOpen נפרד מ-onEvent: אירוע state מגיע רק כשמשהו *משתנה*, ולכן
 *    בלי סימון החיבור ברגע ה-hello, מחוון הקישוריות היה מציג "מנותק"
 *    עד לשינוי הראשון בנתונים — כלומר משקר בדיוק כשהכול תקין.
 */
export function openStream(
  onEvent: (payload: StreamPayload) => void,
  onError?: () => void,
  onOpen?: () => void
) {
  const source = new EventSource(`/api/stream?k=${encodeURIComponent(secret)}`);
  source.addEventListener('hello', () => onOpen?.());
  source.onopen = () => onOpen?.();
  source.addEventListener('state', (e) => {
    try {
      onEvent(JSON.parse((e as MessageEvent).data));
    } catch {
      /* הודעה פגומה — מתעלמים, הרענון הבא יתקן */
    }
  });
  source.onerror = () => onError?.();
  return () => source.close();
}

export interface StreamPayload {
  version: number;
  builtAt: number;
  counts: { alerts: number; critical: number; feedbackNew: number };
  latest: Array<{ id: string; text: string; actorName?: string | null; severity: string }>;
}
