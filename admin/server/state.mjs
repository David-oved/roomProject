import { buildWorld } from './world.mjs';
import { buildEvents } from './activity.mjs';
import { assessAllRooms } from './roomHealth.mjs';
import { analyzeAll } from './insights.mjs';
import { buildFeedbackList, feedbackCounts } from './feedback.mjs';
import { buildAlerts, decorateAlerts, mergeConfig } from './alerts.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  מצב נגזר, עם מטמון
 * ═══════════════════════════════════════════════════════════════
 *  כל הניתוחים תלויים זה בזה (התראות תלויות בבריאות חדרים, שתלויה
 *  בעולם, שתלוי במראה). לכן הם מחושבים יחד, פעם אחת, ומסומנים
 *  כמלוכלכים כשהעץ משתנה.
 *
 *  version עולה בכל בנייה — ה-SSE משדר אותו, והלקוח יודע לרענן.
 * ═══════════════════════════════════════════════════════════════
 */

export function createState(db) {
  let cached = null;
  let version = 0;
  let dirty = true;
  const subscribers = new Set();

  db.onChange(() => {
    dirty = true;
    // דחיפה קצרה — עדכון RTDB אחד מפעיל לעיתים כמה אירועי value
    setTimeout(() => notify(), 60);
  });

  let notifyTimer = null;
  function notify() {
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      const state = getState();
      for (const fn of subscribers) {
        try {
          fn(state);
        } catch (err) {
          console.error('מנוי נכשל:', err.message);
        }
      }
    }, 80);
  }

  function build() {
    const snapshot = db.snapshot() ?? {};
    const now = Date.now();
    const world = buildWorld(snapshot, now);
    const events = buildEvents(world);
    const health = assessAllRooms(world);
    const analytics = analyzeAll(world, events, 30);
    const feedbackItems = buildFeedbackList(world);
    const alertConfig = mergeConfig(world.console?.alertConfig);
    const alerts = decorateAlerts(
      buildAlerts(world, events, feedbackItems, alertConfig),
      world.console?.alertState,
      now
    );

    version++;
    cached = {
      version,
      builtAt: now,
      snapshot,
      world,
      events,
      health,
      analytics,
      feedbackItems,
      feedbackCounts: feedbackCounts(feedbackItems),
      alerts,
      alertConfig,
    };
    dirty = false;
    return cached;
  }

  function getState() {
    if (dirty || !cached) return build();
    // בנייה מחדש כל דקה גם בלי שינוי — "לפני 3 דקות" חייב להתקדם,
    // וגם התראות מבוססות-זמן (פריט שהזדקן) חייבות לצוץ מעצמן.
    if (Date.now() - cached.builtAt > 60_000) return build();
    return cached;
  }

  return {
    get: getState,
    invalidate() {
      dirty = true;
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    /** דופק תקופתי — מייצר בנייה מחדש כדי שההתראות יתעדכנו לבד. */
    startHeartbeat(ms = 60_000) {
      const timer = setInterval(() => {
        dirty = true;
        notify();
      }, ms);
      timer.unref?.();
      return () => clearInterval(timer);
    },
  };
}
