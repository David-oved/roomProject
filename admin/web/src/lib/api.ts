/**
 * לקוח ה-API.
 *
 * הטוקן מגיע פעם אחת ב-query string (ה-launcher פותח את הדפדפן איתו),
 * נשמר ב-localStorage, ומוסר מיד מכתובת ה-URL — כדי שלא יישאר
 * בהיסטוריית הדפדפן או בכותרת החלון.
 */

const TOKEN_KEY = 'roommate-admin-token';

function readTokenFromUrl(): string | null {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('token');
  if (!token) return null;
  url.searchParams.delete('token');
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  return token;
}

let token: string = readTokenFromUrl() ?? localStorage.getItem(TOKEN_KEY) ?? '';
if (token) localStorage.setItem(TOKEN_KEY, token);

export function getStoredToken() {
  return token;
}

export function setToken(next: string) {
  token = next.trim();
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  token = '';
  localStorage.removeItem(TOKEN_KEY);
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
    headers: {
      'content-type': 'application/json',
      'x-admin-token': token,
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
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
  /** קישור ישיר להורדה/הדפסה — הדפדפן מוריד, ולכן הטוקן ב-query. */
  fileUrl: (path: string, params?: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams({ token });
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
    }
    return `/api${path}?${search.toString()}`;
  },
};

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
  const source = new EventSource(`/api/stream?token=${encodeURIComponent(token)}`);
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
