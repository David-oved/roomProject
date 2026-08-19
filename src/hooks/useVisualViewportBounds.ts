import { useEffect, useState } from 'react';

/**
 * גובה+מיקום ה-visual viewport בפועל, ממש עכשיו — לא fixed inset-0,
 * לא 100dvh, בלי לנחש כמה גבוהה המקלדת.
 *
 * למסכי מסך-מלא (בלי AppShell) עם שדה קלט בתחתית: מציבים את הקונטיינר
 * הראשי עם style={{ top, height }} מהערך הזה (fixed inset-x-0), ואז שדה
 * הקלט חוזר להיות ילד flex רגיל בתחתית — לא fixed, בלי transform. הוא
 * "עולה" מעל המקלדת רק כי אזור התוכן שמעליו (flex-1) הוא היחיד שמתכווץ.
 *
 * ‼️ למה לא fixed inset-0 + שורת קלט fixed נפרדת שמוזזת ב-transform:
 * זה הסתמך על הנחה שגויה ש-window.innerHeight לא זז עם המקלדת. בברירת
 * המחדל של רוב דפדפני אנדרואיד/כרום זה לא נכון, והתוצאה מרגישה כאילו
 * "הכל" (כולל הרקע) עולה יחד עם שדה הקלט. ראו ChatConversationPage
 * להיסטוריה המלאה של הבאג.
 *
 * למודאל מרכזי (לא מסך מלא) יש צורך שונה — ראו readVisualViewportBounds
 * למטה.
 */
export function useVisualViewportBounds(): { top: number; height: number } {
  const [bounds, setBounds] = useState(readVisualViewportBounds);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function sync() {
      setBounds(readVisualViewportBounds());
    }

    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    sync();

    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
    };
  }, []);

  return bounds;
}

/** קריאה חד-פעמית, לא הוק — ראו readVisualViewportBounds. */
export function readVisualViewportBounds(): { top: number; height: number } {
  return {
    height: window.visualViewport?.height ?? window.innerHeight,
    top: window.visualViewport?.offsetTop ?? 0,
  };
}
