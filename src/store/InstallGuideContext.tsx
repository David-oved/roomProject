import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isStandalone } from '../lib/installGuide';

/** אירוע לא-סטנדרטי שקיים רק בדפדפני כרומיום — אין לו טיפוס ב-lib.dom */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallGuideApi {
  /** האם האפליקציה כבר מותקנת (רצה כ-standalone) במכשיר הזה */
  installed: boolean;
  open: boolean;
  openGuide: () => void;
  closeGuide: () => void;
  canNativeInstall: boolean;
  promptNativeInstall: () => Promise<void>;
}

const Ctx = createContext<InstallGuideApi | null>(null);
export const useInstallGuide = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInstallGuide must be used within InstallGuideProvider');
  return ctx;
};

/**
 * מרכז את זרימת "התקנת האפליקציה למסך הבית" כולה: תפיסת אירוע ההתקנה
 * המובנה של הדפדפן (זמין רק בכרום/edge), פתיחת המודאל ההסברי, וזיהוי
 * שהאפליקציה כבר מותקנת כדי לא להטריד משתמש שכבר עשה את זה.
 *
 * ברמת השורש (App.tsx) ולא בתוך RoomLayout — ההרשמה, שממנה הפתיחה
 * האוטומטית הראשונה מגיעה, קודמת לכניסה לחדר.
 */
export function InstallGuideProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(isStandalone);
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault(); // מונע את הבאנר האוטומטי של הדפדפן — אנחנו מציגים הסבר משלנו
      deferredRef.current = e as BeforeInstallPromptEvent;
      setCanNativeInstall(true);
    }
    function onInstalled() {
      setInstalled(true);
      setOpen(false);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const openGuide = useCallback(() => {
    if (isStandalone()) return; // כבר מותקן — אין מה להסביר
    setOpen(true);
  }, []);
  const closeGuide = useCallback(() => setOpen(false), []);

  const promptNativeInstall = useCallback(async () => {
    const deferred = deferredRef.current;
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferredRef.current = null;
    setCanNativeInstall(false);
  }, []);

  const api = useMemo<InstallGuideApi>(
    () => ({ installed, open, openGuide, closeGuide, canNativeInstall, promptNativeInstall }),
    [installed, open, openGuide, closeGuide, canNativeInstall, promptNativeInstall]
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
