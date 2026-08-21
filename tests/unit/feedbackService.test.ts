import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BODY_MAX,
  FeedbackValidationError,
  SUBJECT_MAX,
  describeEnvironment,
  validateFeedback,
} from '../../src/services/feedbackService';
import {
  ArchivedRoomError,
  assertRoomWritable,
  isRoomArchived,
  setRoomArchived,
} from '../../src/services/guard';

/**
 * ═══════════════════════════════════════════════════════════════
 *  הערוץ מול מנהל המערכת — צד הלקוח
 * ═══════════════════════════════════════════════════════════════
 *  שתי הבדיקות החשובות כאן:
 *   1. הוולידציה המקומית תואמת בדיוק לכללי האבטחה. כשהן יוצאות
 *      מסנכרון, המשתמש מקבל PERMISSION_DENIED במקום הסבר.
 *   2. חדר בארכיון חוסם כתיבה — ורק את החדר הנכון.
 * ═══════════════════════════════════════════════════════════════
 */

const valid = { type: 'bug' as const, subject: 'הכפתור לא עובד', body: 'לחצתי ולא קרה כלום' };

describe('validateFeedback', () => {
  it('מקבל פנייה תקינה', () => {
    expect(() => validateFeedback(valid)).not.toThrow();
  });

  it('דוחה נושא קצר מדי — אותו סף כמו בכללי האבטחה (3 תווים)', () => {
    expect(() => validateFeedback({ ...valid, subject: 'אב' })).toThrow(FeedbackValidationError);
    expect(() => validateFeedback({ ...valid, subject: 'אבג' })).not.toThrow();
  });

  it('דוחה נושא ארוך מ-80 תווים', () => {
    expect(() => validateFeedback({ ...valid, subject: 'א'.repeat(SUBJECT_MAX) })).not.toThrow();
    expect(() => validateFeedback({ ...valid, subject: 'א'.repeat(SUBJECT_MAX + 1) })).toThrow();
  });

  it('דוחה גוף ריק ומחזיר את שם השדה שנכשל', () => {
    try {
      validateFeedback({ ...valid, body: '   ' });
      throw new Error('היה אמור להיכשל');
    } catch (err) {
      expect(err).toBeInstanceOf(FeedbackValidationError);
      expect((err as FeedbackValidationError).field).toBe('body');
    }
  });

  it('דוחה גוף ארוך מ-2000 תווים', () => {
    expect(() => validateFeedback({ ...valid, body: 'א'.repeat(BODY_MAX) })).not.toThrow();
    expect(() => validateFeedback({ ...valid, body: 'א'.repeat(BODY_MAX + 1) })).toThrow();
  });

  it('רווחים בקצוות אינם נחשבים לתוכן', () => {
    expect(() => validateFeedback({ ...valid, subject: '  אב  ' })).toThrow();
  });
});

describe('describeEnvironment', () => {
  it('מזהה דפדפן ומערכת הפעלה, ולא חורג ממגבלת האורך של הכללים', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Mobile/15E148 Safari/604.1',
      language: 'he-IL',
    });
    vi.stubGlobal('window', {
      innerWidth: 390,
      innerHeight: 844,
      matchMedia: () => ({ matches: false }),
      navigator: {},
    });

    const env = describeEnvironment();
    expect(env.browser).toBe('Safari');
    expect(env.os).toBe('iOS');
    expect(env.screen).toBe('390×844');
    expect(env.installed).toBe('לא');
    // כל ערך מוגבל ל-60 תווים ב-database.rules.json
    for (const value of Object.values(env)) expect(value.length).toBeLessThanOrEqual(60);

    vi.unstubAllGlobals();
  });

  it('מסמן אפליקציה שהותקנה למסך הבית', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120', language: 'he' });
    vi.stubGlobal('window', {
      innerWidth: 412,
      innerHeight: 915,
      matchMedia: () => ({ matches: true }),
      navigator: {},
    });

    expect(describeEnvironment().installed).toBe('כן');
    vi.unstubAllGlobals();
  });
});

describe('שומר החדר המאורכב', () => {
  beforeEach(() => setRoomArchived(null, false));

  it('חוסם כתיבה רק לחדר שאורכב', () => {
    setRoomArchived('AB2K7Q', true);
    expect(isRoomArchived('AB2K7Q')).toBe(true);
    expect(isRoomArchived('CD4RM8')).toBe(false);

    expect(() => assertRoomWritable('AB2K7Q', 'לדווח על מוצר')).toThrow(ArchivedRoomError);
    expect(() => assertRoomWritable('CD4RM8', 'לדווח על מוצר')).not.toThrow();
  });

  it('ביטול הארכוב פותח את החדר מחדש', () => {
    setRoomArchived('AB2K7Q', true);
    setRoomArchived('AB2K7Q', false);
    expect(() => assertRoomWritable('AB2K7Q')).not.toThrow();
  });

  it('הודעת השגיאה מסבירה למה — ולא רק שנכשל', () => {
    setRoomArchived('AB2K7Q', true);
    try {
      assertRoomWritable('AB2K7Q', 'לרשום קנייה');
      throw new Error('היה אמור להיכשל');
    } catch (err) {
      expect((err as Error).message).toContain('לרשום קנייה');
      expect((err as Error).message).toContain('ארכיון');
    }
  });
});
