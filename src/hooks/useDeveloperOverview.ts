import { useCallback, useEffect, useState } from 'react';
import { get, ref } from 'firebase/database';
import { db } from '../config/firebase';
import type { Member, RoomMetadata, UserProfile, WithId } from '../types/models';

export interface DeveloperRoom {
  code: string;
  metadata: RoomMetadata;
  members: WithId<Member>[];
}

interface DeveloperOverviewState {
  loading: boolean;
  error: Error | null;
  rooms: DeveloperRoom[];
  users: WithId<UserProfile>[];
  loadedAt: number | null;
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  תמונת מצב חוצת-חדרים לפאנל המפתח
 * ═══════════════════════════════════════════════════════════════
 *  טעינה חד-פעמית (get, לא onValue) ולא מנוי חי — זה כלי לעיון
 *  מזדמן של אדם אחד, לא מסך שצריך להתעדכן בזמן אמת. מנוי חי היה
 *  פותח שני חיבורים לכל חדר קיים בבת אחת, בלי שום צורך אמיתי.
 *
 *  ‼️ שלוש קריאות בזו אחר זו, לא אחת:
 *   1. roomCodes — האינדקס היחיד שחושף אילו קודי חדר קיימים בכלל.
 *   2. לכל קוד: metadata + members בנפרד — לא rooms/$code כולו.
 *      זה בדיוק מה שהכללים מרשים לחשבון הזה (ראו database.rules.json
 *      וdocs/14-developer-panel.md): לא קניות, לא צ'אט, לא מאזנים.
 *   3. users — לתפוס גם משתמשים שלא הצטרפו לאף חדר, שאף חדר לא
 *      "יודע" עליהם.
 * ═══════════════════════════════════════════════════════════════
 */
export function useDeveloperOverview() {
  const [state, setState] = useState<DeveloperOverviewState>({
    loading: true,
    error: null,
    rooms: [],
    users: [],
    loadedAt: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [codesSnap, usersSnap] = await Promise.all([
        get(ref(db, 'roomCodes')),
        get(ref(db, 'users')),
      ]);

      const codes = Object.keys((codesSnap.val() as Record<string, unknown> | null) ?? {});

      const rooms = (
        await Promise.all(
          codes.map(async (code): Promise<DeveloperRoom | null> => {
            const [metaSnap, membersSnap] = await Promise.all([
              get(ref(db, `rooms/${code}/metadata`)),
              get(ref(db, `rooms/${code}/members`)),
            ]);
            const metadata = metaSnap.val() as RoomMetadata | null;
            // roomCodes/$code בלי rooms/$code/metadata תואם = חדר שנמחק
            // אבל האינדקס עדיין לא נוקה. אין מה להציג — מדלגים בשקט.
            if (!metadata) return null;

            const membersVal = (membersSnap.val() as Record<string, Member> | null) ?? {};
            return {
              code,
              metadata,
              members: Object.entries(membersVal).map(([id, m]) => ({ ...m, id })),
            };
          })
        )
      ).filter((r): r is DeveloperRoom => r !== null);

      const usersVal = (usersSnap.val() as Record<string, UserProfile> | null) ?? {};
      const users = Object.entries(usersVal).map(([id, u]) => ({ ...u, id }));

      rooms.sort((a, b) => (b.metadata.createdAt ?? 0) - (a.metadata.createdAt ?? 0));
      users.sort((a, b) => (b.lastActiveAt ?? b.createdAt ?? 0) - (a.lastActiveAt ?? a.createdAt ?? 0));

      setState({ loading: false, error: null, rooms, users, loadedAt: Date.now() });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err as Error }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
