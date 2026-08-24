import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { PageTransition } from './PageTransition';
import { useLiveNotifications } from '../../hooks/useLiveNotifications';
import { useChatWatcher } from '../../hooks/useChatWatcher';
import { OfflineBanner } from './OfflineBanner';

/**
 * מעטפת המסכים שבתוך חדר.
 *
 * הריפוד התחתון מחשב גם את גובה הניווט וגם את האזור הבטוח (פס הבית
 * באייפון) — בלעדיו התוכן האחרון ברשימה מוסתר מאחורי הסרגל.
 */
export function AppShell({ children }: { children: ReactNode }) {
  // התראה מיידית כשהאפליקציה ברקע — בלי להמתין לשרת
  useLiveNotifications();

  // עוקב אחרי כל שיחות הצ'אט: מסמן delivered, סופר לא-נקרא, וטוסט מקומי
  const { unreadTotal } = useChatWatcher();

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-ink-50">
      {/* ‼️ קישוט רקע בלבד — fixed ו-pointer-events-none, לא תופס מקום
          בפריסה ולא מפריע לגלילה. מוסיף עומק עדין בלי לגעת בתוכן עצמו. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b
                   from-brand-200/40 via-brand-100/10 to-transparent"
      />
      <OfflineBanner />

      <main
        className="mx-auto max-w-lg px-4 safe-x"
        style={{ paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom) + 1.5rem)' }}
      >
        <PageTransition>{children}</PageTransition>
      </main>

      <BottomNav unreadChat={unreadTotal} />
    </div>
  );
}

/**
 * מעטפת למסכים שמחוץ לחדר (התחברות, הצטרפות) — בלי ניווט תחתון.
 *
 * ‼️ hasTopBar נדרש כי בתשעה מסכים ה-TopBar מרונדר *מחוץ* ל-PlainShell
 * (אחות שלו, לא ילד). בלי הדגל נוצרו שם שני באגים מצטברים:
 *
 *  1. ריפוד כפול של האזור הבטוח — TopBar מרפד --safe-top בעצמו,
 *     ו-PlainShell הוסיף אותו שוב מתחתיו.
 *  2. min-height של 100dvh *בנוסף* לגובה ה-TopBar שמעליו, כלומר גובה
 *     מסמך של 100dvh + גובה כותרת. באייפון עם נאץ' זה כ-115px של
 *     גלילה מתה בתחתית כל אחד מהמסכים האלה, גם כשאין תוכן.
 *
 * כשהדגל דלוק: אין --safe-top כפול, וה-min-height מנכה את הכותרת.
 */
export function PlainShell({
  children,
  hasTopBar = false,
}: {
  children: ReactNode;
  /** האם המסך מרנדר TopBar *מעל* המעטפת הזו (ולא בתוכה) */
  hasTopBar?: boolean;
}) {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-brand-50/60 to-ink-50">
      <OfflineBanner />
      <main
        className="mx-auto flex max-w-md flex-col px-5 safe-x"
        style={{
          minHeight: hasTopBar
            ? 'calc(100dvh - var(--header-height) - var(--safe-top))'
            : '100dvh',
          paddingTop: hasTopBar ? '1rem' : 'calc(var(--safe-top) + 1rem)',
          paddingBottom: 'calc(var(--safe-bottom) + 1.5rem)',
        }}
      >
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
