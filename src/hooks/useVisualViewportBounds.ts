import { useEffect, useState } from 'react';

export interface VisualViewportBounds {
  /** מרחק מראש ה-layout viewport עד ראש האזור הנראה בפועל */
  top: number;
  /** הגובה הנראה בפועל — כלומר בלי מה שהמקלדת מכסה */
  height: number;
  /** ‼️ מרחק משמאל. שונה מ-0 רק בזום-צביטה — ראו ההסבר למטה */
  left: number;
  /** הרוחב הנראה בפועל. קטן מרוחב הדף בזום-צביטה */
  width: number;
}

/**
 * גובה+מיקום ה-visual viewport בפועל, ממש עכשיו — לא fixed inset-0,
 * לא 100dvh, בלי לנחש כמה גבוהה המקלדת.
 *
 * למסכי מסך-מלא (בלי AppShell) עם שדה קלט בתחתית: מציבים את הקונטיינר
 * הראשי עם style={{ top, left, height, width }} מהערך הזה (fixed), ואז
 * שדה הקלט חוזר להיות ילד flex רגיל בתחתית — לא fixed, בלי transform.
 * הוא "עולה" מעל המקלדת רק כי אזור התוכן שמעליו (flex-1) הוא היחיד
 * שמתכווץ.
 *
 * ‼️ למה לא fixed inset-0 + שורת קלט fixed נפרדת שמוזזת ב-transform:
 * זה הסתמך על הנחה שגויה ש-window.innerHeight לא זז עם המקלדת. בברירת
 * המחדל של רוב דפדפני אנדרואיד/כרום זה לא נכון, והתוצאה מרגישה כאילו
 * "הכל" (כולל הרקע) עולה יחד עם שדה הקלט. ראו ChatConversationPage
 * להיסטוריה המלאה של הבאג.
 *
 * ‼️ למה גם left/width ולא רק top/height:
 * הצרכנים עגנו את עצמם ב-inset-x-0, כלומר לרוחב ה-*layout* viewport.
 * בזום-צביטה (שתי אצבעות) ה-visual viewport מצטמצם וזז הצידה, אבל
 * inset-x-0 לא יודע על זה — ולכן שורת הכתיבה והכותרת נדחפו אל מחוץ
 * לאזור הנראה, בלי דרך לגלול אליהן חזרה. עם left+width הן נשארות
 * מעוגנות למה שהמשתמש באמת רואה.
 *
 * ‼️ ויסות ו-bail-out:
 * visualViewport יורה resize *וגם* scroll עשרות פעמים בשנייה בזמן
 * שהמקלדת נפתחת/נסגרת. הגרסה הקודמת קראה setState עם אובייקט חדש בכל
 * אירוע — כלומר React אף פעם לא יכול היה לוותר על הרינדור, גם כשאף
 * ערך לא זז (אירוע scroll טהור). כאן הקריאה מווסתת ל-frame אחד,
 * וההשוואה למטה עוצרת רינדור כשהמספרים זהים.
 *
 * למודאל מרכזי (לא מסך מלא) יש צורך שונה — ראו readVisualViewportBounds
 * למטה ואת ההערה ב-GlassModal.
 */
export function useVisualViewportBounds(): VisualViewportBounds {
  const [bounds, setBounds] = useState(readVisualViewportBounds);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let frame = 0;

    const read = () => {
      frame = 0;
      const next = readVisualViewportBounds();
      setBounds((prev) => (isSameBounds(prev, next) ? prev : next));
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(read);
    };

    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);

    // ‼️ הקריאה הראשונה מיידית ולא דרך rAF: בכניסה למסך הפריסה חייבת
    // להיות נכונה כבר בפריים הראשון, אחרת נראית קפיצה בטעינה.
    read();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
    };
  }, []);

  return bounds;
}

function isSameBounds(a: VisualViewportBounds, b: VisualViewportBounds): boolean {
  return a.top === b.top && a.height === b.height && a.left === b.left && a.width === b.width;
}

/** קריאה חד-פעמית, לא הוק — ראו ההערה ב-GlassModal למה שם זה הנכון. */
export function readVisualViewportBounds(): VisualViewportBounds {
  const vv = window.visualViewport;
  return {
    height: vv?.height ?? window.innerHeight,
    top: vv?.offsetTop ?? 0,
    left: vv?.offsetLeft ?? 0,
    // ‼️ clientWidth ולא innerWidth בנפילה לאחור: innerWidth כולל את
    // רוחב פס הגלילה, וקונטיינר fixed ברוחב הזה גולש אופקית.
    width: vv?.width ?? document.documentElement.clientWidth,
  };
}
