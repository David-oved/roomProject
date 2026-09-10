import { describe, expect, it } from 'vitest';
import { countFairness, FAIRNESS_WINDOW_DAYS } from '../../src/lib/tasks';
import type { TaskCompletion, WithId } from '../../src/types/models';

const NOW = Date.UTC(2026, 0, 20);
const DAY = 24 * 60 * 60 * 1000;

function completion(
  id: string,
  taskId: string,
  completedBy: string,
  daysAgo: number
): WithId<TaskCompletion> {
  return {
    id,
    taskId,
    taskName: `מטלה ${taskId}`,
    completedBy,
    completedAt: NOW - daysAgo * DAY,
  };
}

describe('countFairness', () => {
  it('סופר לכל חבר את הביצועים שלו בחלון', () => {
    const counts = countFairness(
      [
        completion('c1', 't1', 'dana', 1),
        completion('c2', 't1', 'dana', 3),
        completion('c3', 't1', 'yossi', 2),
      ],
      ['t1'],
      NOW
    );
    expect(counts).toEqual({ dana: 2, yossi: 1 });
  });

  it('מתעלם מביצועים ישנים מחלון ההוגנות', () => {
    const counts = countFairness(
      [
        completion('c1', 't1', 'dana', 1),
        completion('c2', 't1', 'dana', FAIRNESS_WINDOW_DAYS + 1),
      ],
      ['t1'],
      NOW
    );
    expect(counts).toEqual({ dana: 1 });
  });

  // הבאג שדווח: המספר "כמה מטלות עשיתי החודש" נשאר תקוע אחרי מחיקת
  // המטלה, כי היומן append-only ורשומות הביצוע שורדות את המחיקה.
  it('מתעלם מביצועים של מטלה שנמחקה', () => {
    const completions = [
      completion('c1', 'נשארה', 'dana', 1),
      completion('c2', 'נמחקה', 'dana', 2),
      completion('c3', 'נמחקה', 'yossi', 2),
    ];

    expect(countFairness(completions, ['נשארה', 'נמחקה'], NOW)).toEqual({ dana: 2, yossi: 1 });
    // אחרי שהמנהל מחק את המטלה "נמחקה":
    expect(countFairness(completions, ['נשארה'], NOW)).toEqual({ dana: 1 });
  });

  it('בלי מטלות חיות הספירה ריקה — לא נופל', () => {
    expect(countFairness([completion('c1', 't1', 'dana', 1)], [], NOW)).toEqual({});
  });

  it('רשומה בלי completedAt לא נספרת ולא מפילה', () => {
    const broken = { ...completion('c1', 't1', 'dana', 1), completedAt: undefined as unknown as number };
    expect(countFairness([broken], ['t1'], NOW)).toEqual({});
  });
});
