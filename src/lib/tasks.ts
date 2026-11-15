import type { TaskCompletion, WithId } from '../types/models';

/** חלון ההוגנות — כמה זמן אחורה סופרים ביצועי מטלות */
export const FAIRNESS_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * סופר כמה מטלות כל חבר השלים בחלון ההוגנות.
 *
 * ‼️ סופרים **רק ביצועים של מטלות שעדיין קיימות**. הסיבה: מחיקת מטלה
 * לא מוחקת את רשומות ה-taskCompletions שלה — היומן הוא append-only
 * וה-Rules אוסרים למחוק ממנו (ובצדק: אחרת מנהל היה יכול למחוק בררנית
 * היסטוריית הוגנות של חבר מסוים). בלי הסינון הזה המספר "כמה עשיתי
 * החודש" נשאר תקוע גם אחרי שהמטלה נמחקה, ואין שום דרך למשתמש להוריד
 * אותו — זה נראה כמו באג ספירה, וזה מה שדווח בפועל.
 *
 * הסינון בצד הקריאה ולא בצד המחיקה משמר את היומן עצמו: אם המטלה
 * תיווצר מחדש היא תקבל מזהה חדש ממילא, כך שהרשומות הישנות נשארות
 * מחוץ לספירה לתמיד — בדיוק ההתנהגות שמצפים לה ממחיקה.
 */
export function countFairness(
  completions: WithId<TaskCompletion>[],
  liveTaskIds: Iterable<string>,
  now: number = Date.now()
): Record<string, number> {
  const live = liveTaskIds instanceof Set ? liveTaskIds : new Set(liveTaskIds);
  const since = now - FAIRNESS_WINDOW_DAYS * DAY_MS;

  const counts: Record<string, number> = {};
  for (const c of completions) {
    if ((c.completedAt ?? 0) < since) continue;
    if (!live.has(c.taskId)) continue;
    counts[c.completedBy] = (counts[c.completedBy] ?? 0) + 1;
  }
  return counts;
}
