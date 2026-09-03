import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * עוטף את תוכן העמוד באנימציית כניסה קלה בכל מעבר בין טאבים/מסכים.
 *
 * ‼️ ה-key הוא ה-pathname: זו כל התחבולה. React רואה key חדש → מפרק
 * את ה-div הישן ובונה חדש, ולכן מחלקת ה-animate-page-in "נדלקת" שוב
 * מאפס בכל ניווט, בדיוק כמו שהיא נדלקת ב-mount ראשוני. בלי key, React
 * היה ממחזר את אותו DOM node ולא היה שום דבר להריץ מחדש.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
