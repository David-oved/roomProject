import colors from 'tailwindcss/colors';

/**
 * ‼️ צבעים דרך משתני CSS, לא הקסים סטטיים — זו התשתית של מצב כהה.
 *
 * במקום למרוח `dark:` על אלפי מקומות שימוש בכל הקוד, כל גוון כאן
 * (ink/brand/rose/emerald/...) מוגדר פעם אחת כ-`rgb(var(--x) / <alpha-value>)`.
 * הערך בפועל של המשתנה משתנה לפי מחלקת `.dark` על ה-<html> (ראו
 * src/styles/index.css) — כלומר `bg-ink-50` נשאר `bg-ink-50` בכל הקבצים,
 * אבל "מה זה בעצם" מתהפך אוטומטית. `<alpha-value>` הוא placeholder
 * שטיילווינד ממלא בזמן קומפילציה עבור מאפייני אטימות כמו `bg-ink-50/60` —
 * חובה rgb(var(...) / ...) ולא rgba() ישיר, אחרת מאפייני אטימות נשברים.
 *
 * ink הופך בהיפוך מלא של הסולם (50↔900 וכו') — הוא משמש גם לטקסט וגם
 * לרקעים ניטרליים בכל האפליקציה, כך שהיפוך שלם שומר על אותה סמנטיקה
 * ("900 = הכי ניגודי") משני צידי החוזה. brand/rose/emerald/amber/sky/
 * violet הופכים רק בטווח ה"גוון הבהיר" (50-300 ו-700-900) — 400-600
 * נשארים קבועים, כי אלה הגוונים שמשמשים למילוי אחיד עם טקסט לבן
 * (כפתורים, תגיות) וצריכים להישאר זהים ומזוהים בשני המצבים.
 */
const varColor = (name) => ({
  50: `rgb(var(--${name}-50) / <alpha-value>)`,
  100: `rgb(var(--${name}-100) / <alpha-value>)`,
  200: `rgb(var(--${name}-200) / <alpha-value>)`,
  300: `rgb(var(--${name}-300) / <alpha-value>)`,
  400: `rgb(var(--${name}-400) / <alpha-value>)`,
  500: `rgb(var(--${name}-500) / <alpha-value>)`,
  600: `rgb(var(--${name}-600) / <alpha-value>)`,
  700: `rgb(var(--${name}-700) / <alpha-value>)`,
  800: `rgb(var(--${name}-800) / <alpha-value>)`,
  900: `rgb(var(--${name}-900) / <alpha-value>)`,
});

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: varColor('brand'),
        // מילוי כפתור ראשי — לא נגזר מ-varColor כי הוא לא מתהפך במצב כהה
        // (ראו ההערה ב-src/styles/index.css). טקסט לבן עליו עובר את התקן.
        'brand-fill': {
          DEFAULT: 'rgb(var(--brand-fill) / <alpha-value>)',
          hover: 'rgb(var(--brand-fill-hover) / <alpha-value>)',
          active: 'rgb(var(--brand-fill-active) / <alpha-value>)',
        },
        // מילויי סטטוס לטוסטים ולבאנרים — אותו היגיון כמו brand-fill:
        // לא נגזרים מהסולם כי הם נושאים טקסט לבן ולכן אסור להם להתהפך.
        'success-fill': 'rgb(var(--success-fill) / <alpha-value>)',
        'warn-fill': 'rgb(var(--warn-fill) / <alpha-value>)',
        'info-fill': 'rgb(var(--info-fill) / <alpha-value>)',
        'danger-fill': 'rgb(var(--danger-fill) / <alpha-value>)',
        'muted-fill': 'rgb(var(--muted-fill) / <alpha-value>)',
        // teal-* משמש רק ב-Avatar.tsx (פלטת צבעי ראשי-תיבות) — ומכיוון
        // ש"brand" הוא בעצם ה-teal של Tailwind בשם אחר, פשוט מצביע על
        // אותם משתנים. שינוי אחד, שני השמות עדיין מסונכרנים.
        teal: varColor('brand'),
        ink: varColor('ink'),
        rose: varColor('rose'),
        emerald: varColor('emerald'),
        amber: varColor('amber'),
        sky: varColor('sky'),
        violet: varColor('violet'),
        // גוונים נוספים בפלטת האווטאר (Avatar.tsx) — רק 100/800 בשימוש,
        // כך שרק הם הופכים; שאר הסולם נשאר ברירת המחדל של Tailwind.
        lime: { ...colors.lime, 100: 'rgb(var(--lime-100) / <alpha-value>)', 800: 'rgb(var(--lime-800) / <alpha-value>)' },
        fuchsia: { ...colors.fuchsia, 100: 'rgb(var(--fuchsia-100) / <alpha-value>)', 800: 'rgb(var(--fuchsia-800) / <alpha-value>)' },
        cyan: { ...colors.cyan, 100: 'rgb(var(--cyan-100) / <alpha-value>)', 800: 'rgb(var(--cyan-800) / <alpha-value>)' },
        // משטח כרטיסים/גיליונות/שדות — במקום `bg-white` הליטרלי. "white"
        // עצמו נשאר ללא נגיעה בכוונה: הוא עדיין נחוץ קבוע (לא הופך) לטקסט
        // על כפתורים צבעוניים ולמסכי מסך (scrim מאחורי מודאלים).
        surface: 'rgb(var(--surface) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Assistant', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        // כותרות (h1/h2, כותרות מסך) — סריף עברי בעל אופי. ה-fallback הוא
        // Assistant *ולא* סריף מערכת: עד שהגופן נטען עדיף גוף מוכר על
        // סריף גנרי, וגם למי שהגופן נכשל אצלו הטיפוגרפיה נשארת קוהרנטית.
        serif: ['"Frank Ruhl Libre"', 'Assistant', 'Georgia', 'serif'],
        // לספרות בכרטיס היתרה — מראה "מסמך פיננסי" ולא רק טקסט מודגש
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '1.125rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,25,23,.04), 0 4px 16px -4px rgba(28,25,23,.08)',
        lifted: '0 2px 4px rgba(28,25,23,.06), 0 12px 28px -8px rgba(28,25,23,.16)',
        fab: '0 4px 14px -2px rgba(31,86,115,.4)',
        // "Liquid Glass" של אפל — הבועה בסרגל הניווט התחתון כשגוררים אותה.
        // הבהוב לבן פנימי מלמעלה (הקצה שתופס אור), מסגרת דקה כהה-עדינה
        // למטה שנותנת עומק, וצל חיצוני רך שמרים את הבועה מעל הסרגל.
        glass:
          'inset 0 1px 1px rgba(255,255,255,.7), inset 0 -1px 1px rgba(0,0,0,.06), ' +
          '0 8px 20px -6px rgba(0,0,0,.35)',
      },
      keyframes: {
        'slide-up': {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'glass-in': {
          from: { transform: 'scale(.94) translateY(8px)', opacity: '0' },
          to: { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        'check-pop': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '60%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(-100%)' },
        },
        'page-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(.99)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'slide-up': 'slide-up .28s cubic-bezier(.22,1,.36,1)',
        'fade-in': 'fade-in .18s ease-out',
        'sheet-in': 'sheet-in .3s cubic-bezier(.22,1,.36,1)',
        'glass-in': 'glass-in .32s cubic-bezier(.22,1,.36,1)',
        'check-pop': 'check-pop .45s cubic-bezier(.34,1.56,.64,1)',
        'page-in': 'page-in .32s cubic-bezier(.22,1,.36,1)',
      },
    },
  },
  plugins: [],
};
