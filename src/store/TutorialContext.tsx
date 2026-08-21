import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRoom } from './RoomContext';
import { getTutorialSeen, setTutorialSeen } from '../lib/prefs';

interface TutorialApi {
  open: boolean;
  openTutorial: () => void;
  closeTutorial: () => void;
}

const TutorialContext = createContext<TutorialApi>({
  open: false,
  openTutorial: () => {},
  closeTutorial: () => {},
});

export const useTutorial = () => useContext(TutorialContext);

/**
 * פותח את ההדרכה פעם אחת אוטומטית בכניסה ראשונה למכשיר, וחושף פתיחה
 * ידנית (למשל מ-הגדרות ← אודות). "נצפתה" הוא דגל מכשיר גלובלי ולא
 * per-room — ראו lib/prefs.ts — כך שמעבר בין חדרים לא מציג אותה שוב.
 */
export function TutorialProvider({ children }: { children: ReactNode }) {
  const { loading } = useRoom();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (getTutorialSeen()) return;
    setOpen(true);
  }, [loading]);

  const closeTutorial = () => {
    setOpen(false);
    setTutorialSeen(true);
  };

  return (
    <TutorialContext.Provider value={{ open, openTutorial: () => setOpen(true), closeTutorial }}>
      {children}
    </TutorialContext.Provider>
  );
}
