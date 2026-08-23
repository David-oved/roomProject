import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * ‼️ אותם קבועים שמוזרקים ב-vite.config.ts חייבים להיות מוגדרים גם כאן.
 *    בלעדיהם כל בדיקה שנוגעת בשרשרת ייבוא שמגיעה ל-lib/version.ts
 *    נופלת עם "__APP_VERSION__ is not defined" — שגיאה שנראית כאילו
 *    הקוד שבור, בזמן שרק סביבת הבדיקה חסרה הגדרה.
 */
const versionFile = fileURLToPath(new URL('./public/version.json', import.meta.url));
const { version } = JSON.parse(readFileSync(versionFile, 'utf8')) as { version: string };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_TIME__: JSON.stringify('test'),
    __BUILD_ID__: JSON.stringify('test'),
  },
  test: {
    environment: 'node',
    globals: true,
    /**
     * ‼️ גם .tsx — בדיקות מסך הטעינה (tests/unit/loadingGuards.test.tsx)
     *    מרנדרות רכיבי React אמיתיים. ברירת המחדל כאן היא node; כל
     *    קובץ שצריך DOM מכריז על כך בעצמו עם
     *    `// @vitest-environment jsdom` בראש הקובץ, כדי שלא נשלם על
     *    הקמת jsdom בכל בדיקת לוגיקה טהורה.
     */
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      include: ['src/lib/**'],
    },
  },
});
