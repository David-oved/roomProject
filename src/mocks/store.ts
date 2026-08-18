/**
 * ═══════════════════════════════════════════════════════════════════
 *  מאגר בזיכרון שמדמה את Realtime Database — למצב דמו בלבד
 * ═══════════════════════════════════════════════════════════════════
 *
 *  למה זה קיים: בלי backend אי אפשר להגיע לאף מסך מעבר להתחברות,
 *  ולכן אי אפשר לבדוק את רוב האפליקציה. המאגר הזה מאפשר להריץ את
 *  כל הזרימות — כולל סנכרון "בזמן אמת" בין טאבים — בלי Firebase.
 *
 *  ‼️ הקוד הזה לא נכנס ל-build הרגיל. הוא נטען רק כשמריצים
 *     `npm run demo`, דרך alias ב-vite.config.ts.
 * ═══════════════════════════════════════════════════════════════════
 */

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

const STORAGE_KEY = 'roommate:demo-db';
const CHANNEL = 'roommate:demo-sync';

let root: Record<string, unknown> = {};

/** listeners לפי נתיב מנורמל */
const listeners = new Map<string, Set<(value: unknown) => void>>();

/** סנכרון בין טאבים — כדי לבדוק "משתמש A ומשתמש B" באמת */
const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;

/* ───────────────── עזרי נתיב ───────────────── */

export const normalizePath = (path: string): string =>
  path.replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');

const segments = (path: string): string[] => {
  const p = normalizePath(path);
  return p === '' ? [] : p.split('/');
};

/* ───────────────── קריאה וכתיבה ───────────────── */

export function readPath(path: string): unknown {
  let node: unknown = root;
  for (const seg of segments(path)) {
    if (node === null || typeof node !== 'object') return null;
    node = (node as Record<string, unknown>)[seg];
    if (node === undefined) return null;
  }
  return node === undefined ? null : node;
}

/**
 * כותב ערך בנתיב. ערך null מוחק את הצומת — בדיוק כמו ב-RTDB.
 * מחזיר true אם משהו באמת השתנה.
 */
function writePath(path: string, value: unknown): boolean {
  const segs = segments(path);

  if (segs.length === 0) {
    root = (value ?? {}) as Record<string, unknown>;
    return true;
  }

  const before = JSON.stringify(readPath(path) ?? null);

  let node = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    const next = node[seg];
    if (next === null || typeof next !== 'object' || Array.isArray(next)) {
      node[seg] = {};
    }
    node = node[seg] as Record<string, unknown>;
  }

  const last = segs[segs.length - 1];
  if (value === null || value === undefined) {
    delete node[last];
  } else {
    node[last] = resolveSentinels(value);
  }

  // ניקוי צמתים שהתרוקנו — RTDB לא שומר אובייקטים ריקים
  pruneEmpty(segs.slice(0, -1));

  return before !== JSON.stringify(readPath(path) ?? null);
}

function pruneEmpty(segs: string[]): void {
  for (let depth = segs.length; depth > 0; depth--) {
    const parentSegs = segs.slice(0, depth - 1);
    const key = segs[depth - 1];
    let parent: Record<string, unknown> = root;
    let ok = true;
    for (const s of parentSegs) {
      const next = parent[s];
      if (next === null || typeof next !== 'object') {
        ok = false;
        break;
      }
      parent = next as Record<string, unknown>;
    }
    if (!ok) return;
    const node = parent[key];
    if (node && typeof node === 'object' && Object.keys(node).length === 0) {
      delete parent[key];
    } else {
      return;
    }
  }
}

/* ───────────────── serverTimestamp ───────────────── */

const SENTINEL = '__DEMO_SERVER_TIMESTAMP__';
export const timestampSentinel = () => ({ [SENTINEL]: true });

function resolveSentinels(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(resolveSentinels);

  const obj = value as Record<string, unknown>;
  if (obj[SENTINEL] === true) return Date.now();

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue; // RTDB דוחה undefined — כאן פשוט מדלגים
    out[k] = resolveSentinels(v);
  }
  return out;
}

/* ───────────────── התראות למאזינים ───────────────── */

function isRelated(listenerPath: string, changedPath: string): boolean {
  if (listenerPath === changedPath) return true;
  if (changedPath.startsWith(listenerPath + '/')) return true; // צאצא השתנה
  if (listenerPath.startsWith(changedPath + '/')) return true; // אב השתנה
  return listenerPath === '' || changedPath === '';
}

function notify(changedPaths: string[]): void {
  const unique = [...new Set(changedPaths.map(normalizePath))];
  for (const [lPath, set] of listeners) {
    if (unique.some((c) => isRelated(lPath, c))) {
      const value = readPath(lPath);
      for (const cb of set) cb(value);
    }
  }
}

/* ───────────────── API פנימי ───────────────── */

/** מבצע קבוצת כתיבות כפעולה אחת ומודיע פעם אחת בסוף (כמו update אטומי) */
export function applyUpdates(updates: Record<string, unknown>): void {
  const changed: string[] = [];
  for (const [path, value] of Object.entries(updates)) {
    if (writePath(path, value)) changed.push(path);
  }
  persist();
  broadcast();
  if (changed.length) notify(changed);
}

export function setValue(path: string, value: unknown): void {
  const changed = writePath(path, value);
  persist();
  broadcast();
  if (changed) notify([path]);
}

export function subscribe(path: string, cb: (value: unknown) => void): () => void {
  const key = normalizePath(path);
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(cb);

  // שידור ראשוני מיידי, כמו onValue אמיתי
  cb(readPath(key));

  return () => {
    set!.delete(cb);
    if (set!.size === 0) listeners.delete(key);
  };
}

/* ───────────────── מפתחות בסגנון push ───────────────── */

const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
let lastPushTime = 0;
let lastRandChars: number[] = [];

/** משחזר את האלגוריתם של Firebase: מפתחות ייחודיים וממוינים כרונולוגית */
export function generatePushId(): string {
  let now = Date.now();
  const duplicateTime = now === lastPushTime;
  lastPushTime = now;

  const timeChars: string[] = new Array(8);
  for (let i = 7; i >= 0; i--) {
    timeChars[i] = PUSH_CHARS.charAt(now % 64);
    now = Math.floor(now / 64);
  }

  if (!duplicateTime) {
    lastRandChars = Array.from({ length: 12 }, () => Math.floor(Math.random() * 64));
  } else {
    let i = 11;
    for (; i >= 0 && lastRandChars[i] === 63; i--) lastRandChars[i] = 0;
    if (i >= 0) lastRandChars[i]++;
  }

  return timeChars.join('') + lastRandChars.map((c) => PUSH_CHARS.charAt(c)).join('');
}

/* ───────────────── התמדה וסנכרון בין טאבים ───────────────── */

let persistTimer: number | undefined;

function persist(): void {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
    } catch {
      /* מכסה מלאה — לא קריטי במצב דמו */
    }
  }, 60);
}

let broadcastTimer: number | undefined;

function broadcast(): void {
  if (!channel) return;
  window.clearTimeout(broadcastTimer);
  broadcastTimer = window.setTimeout(() => {
    try {
      channel.postMessage({ root });
    } catch {
      /* מתעלמים */
    }
  }, 40);
}

channel?.addEventListener('message', (e: MessageEvent) => {
  const incoming = (e.data as { root?: Record<string, unknown> })?.root;
  if (!incoming) return;
  root = incoming;
  notify(['']); // כל המאזינים מתרעננים
});

/* ───────────────── אתחול ───────────────── */

export function loadFromStorage(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    root = JSON.parse(raw) as Record<string, unknown>;
    return true;
  } catch {
    return false;
  }
}

export function replaceRoot(next: Record<string, unknown>): void {
  root = next;
  persist();
  broadcast();
  notify(['']);
}

export function resetStore(): void {
  root = {};
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* מתעלמים */
  }
  notify(['']);
}

export const getRoot = () => root;
