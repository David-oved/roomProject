import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
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
    <div className="min-h-[100dvh] bg-ink-50">
      <OfflineBanner />

      <main
        className="mx-auto max-w-lg px-4 safe-x"
        style={{ paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom) + 1.5rem)' }}
      >
        {children}
      </main>

      <BottomNav unreadChat={unreadTotal} />
    </div>
  );
}

/** מעטפת למסכים שמחוץ לחדר (התחברות, הצטרפות) — בלי ניווט תחתון. */
export function PlainShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-brand-50/60 to-ink-50">
      <OfflineBanner />
      <main
        className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 safe-x"
        style={{
          paddingTop: 'calc(var(--safe-top) + 1rem)',
          paddingBottom: 'calc(var(--safe-bottom) + 1.5rem)',
        }}
      >
        {children}
      </main>
    </div>
  );
}
