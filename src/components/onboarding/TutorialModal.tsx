import { useEffect, useState } from 'react';
import { GlassModal } from '../ui/GlassModal';
import { Button } from '../ui/Button';
import { ChevronIcon } from '../ui/icons';
import { useRoom } from '../../store/RoomContext';
import { useTutorial } from '../../store/TutorialContext';
import { TUTORIAL_TABS } from '../../data/onboardingTutorial';

/**
 * הדרכה ראשונית — מוצגת פעם אחת אוטומטית (ראו TutorialContext), וגם
 * ניתנת לפתיחה חוזרת מ-הגדרות ← אודות.
 *
 * ‼️ מרונדרת תמיד (לא רק כש-open) כדי שהאפקט שמאתחל את הטאב בכל פתיחה
 * ירוץ; GlassModal עצמו כבר מטפל ב-unmount-ויזואלי כש-open=false.
 */
export function TutorialModal() {
  const { open, closeTutorial } = useTutorial();
  const { isAdmin } = useRoom();
  const [index, setIndex] = useState(0);
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);

  // מתאפס בכל פתיחה מחדש — אחרת חזרה מ"הגדרות" הייתה ממשיכה מהטאב
  // האחרון שנצפה בפעם הקודמת במקום להתחיל מההתחלה.
  useEffect(() => {
    if (open) {
      setIndex(0);
      setLearnMoreOpen(false);
    }
  }, [open]);

  const tab = TUTORIAL_TABS[index];
  const isFirst = index === 0;
  const isLast = index === TUTORIAL_TABS.length - 1;

  function next() {
    if (isLast) {
      closeTutorial();
      return;
    }
    setIndex((i) => i + 1);
    setLearnMoreOpen(false);
  }

  function back() {
    if (isFirst) return;
    setIndex((i) => i - 1);
    setLearnMoreOpen(false);
  }

  return (
    <GlassModal open={open} onClose={closeTutorial} labelledBy="tutorial-title">
      <div className="flex flex-col p-5 pt-4">
        {/* ── התקדמות ── */}
        <div className="mb-4 flex items-center gap-2">
          <div
            role="progressbar"
            aria-valuenow={index + 1}
            aria-valuemin={1}
            aria-valuemax={TUTORIAL_TABS.length}
            aria-label="התקדמות בהדרכה"
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100"
          >
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-200"
              style={{ width: `${((index + 1) / TUTORIAL_TABS.length) * 100}%` }}
            />
          </div>
          <span className="num shrink-0 text-xs font-semibold text-ink-500">
            {index + 1}/{TUTORIAL_TABS.length}
          </span>
        </div>

        {/* ── תוכן הטאב — key=tab.id מפעיל מחדש את האנימציה בכל מעבר ── */}
        <div key={tab.id} className="animate-fade-in">
          <div className="mb-3 flex items-start gap-3 pe-12">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl">
              {tab.icon}
            </span>
            <h2 id="tutorial-title" className="mt-1.5 text-lg font-bold leading-tight text-ink-900">
              {tab.title}
            </h2>
          </div>

          <p className="text-[15px] leading-relaxed text-ink-700">{tab.short}</p>

          <button
            type="button"
            onClick={() => setLearnMoreOpen((v) => !v)}
            aria-expanded={learnMoreOpen}
            className="tap-area mt-3 flex w-full items-center justify-between rounded-xl
                       bg-ink-50 px-3.5 py-2.5 text-start text-sm font-semibold text-brand-800
                       transition hover:bg-ink-100"
          >
            <span className="inline-flex items-center gap-1.5">💡 עוד פרטים</span>
            <ChevronIcon
              width={16}
              height={16}
              className={`transition-transform ${learnMoreOpen ? 'rotate-90' : '-rotate-90'}`}
            />
          </button>

          {learnMoreOpen && (
            <div className="animate-slide-up mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600">
              {tab.learnMore}
              {isAdmin && tab.adminExtra && (
                <p className="mt-3 rounded-xl bg-brand-50 p-3 text-brand-900">🛡️ {tab.adminExtra}</p>
              )}
            </div>
          )}
        </div>

        {/* ── ניווט ── */}
        <div className="mt-5 flex items-center gap-2">
          {/* ‼️ כיוון החצים ב-RTL: rotate-180 מצביע ימינה = "חזרה" (כמו
              ב-TopBar/ChatConversationPage), ובלי סיבוב = שמאלה = "קדימה". */}
          {!isFirst && (
            <Button variant="secondary" onClick={back} className="flex-1">
              <ChevronIcon width={18} height={18} className="rotate-180" />
              חזרה
            </Button>
          )}
          <Button onClick={next} className="flex-1">
            {isLast ? 'סיימו, בואו נתחיל!' : 'הבא'}
            {!isLast && <ChevronIcon width={18} height={18} />}
          </Button>
        </div>
      </div>
    </GlassModal>
  );
}
