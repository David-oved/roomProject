import { isIOS, isStandalone } from '../services/pushService';

export { isStandalone };

/**
 * זיהוי דפדפן/מכשיר — כדי להציג הוראות התקנה מדויקות במקום הסבר גנרי
 * שמתאים רק לחלק מהמשתמשים.
 *
 * ‼️ באייפון/אייפד כל הדפדפנים (ספארי, כרום, פיירפוקס...) רצים על
 * מנוע ה-WebKit של אפל ומשתמשים באותו תפריט שיתוף מערכתי, ולכן אותן
 * הוראות "כפתור שיתוף ← הוספה למסך הבית" נכונות לכולם — אין צורך
 * להבחין ביניהם.
 */
function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

function isFirefox(): boolean {
  return /Firefox|FxiOS/.test(navigator.userAgent);
}

/** ספארי אמיתי בדסקטופ — לא כרום/edge/פיירפוקס שמזכירים "Safari" ב-UA שלהם */
function isDesktopSafari(): boolean {
  return /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg\//.test(navigator.userAgent);
}

export type InstallGuideKind =
  | 'ios'
  | 'android-native'
  | 'android-manual'
  | 'desktop-native'
  | 'desktop-safari'
  | 'desktop-manual';

export interface InstallGuideContent {
  kind: InstallGuideKind;
  emoji: string;
  headline: string;
  steps: string[];
  note?: string;
  /** האם רלוונטי להציע כפתור "התקנה" שמפעיל את הדיאלוג המובנה של הדפדפן */
  offersNativeButton: boolean;
}

/**
 * @param canNativeInstall - האם אירוע beforeinstallprompt נתפס בפועל
 *   (רק כרום/edge/אנדרואיד עשויים לירות אותו, ורק כשהדפדפן מחליט
 *   שהקריטריונים להתקנה התמלאו — אין להניח שהוא תמיד יגיע).
 */
export function getInstallGuideContent(canNativeInstall: boolean): InstallGuideContent {
  if (isIOS()) {
    return {
      kind: 'ios',
      emoji: '📲',
      headline: 'הוספה למסך הבית',
      steps: [
        'לחצו על כפתור השיתוף (ריבוע עם חץ כלפי מעלה) בסרגל הדפדפן',
        'גללו ברשימה ובחרו "הוספה למסך הבית"',
        'אשרו בלחיצה על "הוספה" בפינה הימנית העליונה',
      ],
      note: 'אחר כך פתחו את RoomMate מהאייקון החדש שנוסף — כך גם התראות יעבדו.',
      offersNativeButton: false,
    };
  }

  if (isAndroid()) {
    if (isFirefox()) {
      return {
        kind: 'android-manual',
        emoji: '📲',
        headline: 'התקנה על מסך הבית',
        steps: ['לחצו על תפריט שלוש הנקודות ⋮ בפינה', 'בחרו "התקנה" (Install)'],
        offersNativeButton: false,
      };
    }
    return {
      kind: 'android-native',
      emoji: '📲',
      headline: 'התקנה על מסך הבית',
      steps: canNativeInstall
        ? ['לחצו על כפתור ההתקנה למטה ואשרו בבקשה שתופיע']
        : [
            'לחצו על תפריט שלוש הנקודות ⋮ בפינה',
            'בחרו "התקנת אפליקציה" או "הוספה למסך הבית"',
          ],
      offersNativeButton: canNativeInstall,
    };
  }

  // ── דסקטופ ──
  if (isDesktopSafari()) {
    return {
      kind: 'desktop-safari',
      emoji: '💻',
      headline: 'הוספה לדוק',
      steps: [
        'בשורת התפריטים למעלה: קובץ ← הוספה לדוק…',
        'או לחצו על כפתור השיתוף בסרגל הכתובת ובחרו "הוספה לדוק"',
      ],
      offersNativeButton: false,
    };
  }

  if (isFirefox()) {
    return {
      kind: 'desktop-manual',
      emoji: '💻',
      headline: 'התקנה בדסקטופ',
      steps: [],
      note: 'פיירפוקס לדסקטופ עדיין לא תומך בהתקנת אפליקציות אינטרנט. אפשר להמשיך להשתמש דרך הדפדפן כרגיל, או לפתוח את הקישור בכרום/edge כדי להתקין.',
      offersNativeButton: false,
    };
  }

  // כרום, edge, ודומיהם — היחידים שתומכים ב-beforeinstallprompt
  return {
    kind: 'desktop-native',
    emoji: '💻',
    headline: 'התקנה על המחשב',
    steps: canNativeInstall
      ? ['לחצו על כפתור ההתקנה למטה ואשרו בחלון שייפתח']
      : [
          'חפשו סמל התקנה (⊕ או מסך עם חץ) בקצה שורת הכתובת',
          'או פתחו את תפריט שלוש הנקודות ⋮ ← "התקנת RoomMate…"',
        ],
    offersNativeButton: canNativeInstall,
  };
}
