import { useEffect, useRef } from 'react';
import type { Alert, AlertConfig } from '../../lib/types';

/**
 * התראות שולחן.
 *
 * ‼️ נשלחת התראה רק על התראה שלא ראיתי קודם *באותה הפעלה*, ורק אם
 *    שעות השקט מאפשרות. בלי הזיכרון הזה, כל רענון של הנתונים היה
 *    מפוצץ את שולחן העבודה באותן שלוש התראות שוב ושוב — וזו הדרך
 *    המהירה ביותר לגרום לעצמי לכבות התראות לתמיד.
 */
export function useDesktopNotifications(
  alerts: Alert[],
  config: AlertConfig | undefined,
  quietHours: boolean
) {
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    if (!config?.delivery.desktop) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') void Notification.requestPermission();
  }, [config?.delivery.desktop]);

  useEffect(() => {
    if (!config?.delivery.desktop || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    // הריצה הראשונה רק ממלאת את הזיכרון — אחרת פתיחת הקונסולה
    // מתחילה במפולת התראות על מצב שכבר ידעתי עליו
    if (!primed.current) {
      for (const alert of alerts) seen.current.add(alert.id);
      primed.current = true;
      return;
    }

    for (const alert of alerts) {
      if (seen.current.has(alert.id) || alert.dismissed) continue;
      seen.current.add(alert.id);

      if (quietHours && !(config.quietHours.criticalOnly && alert.severity === 'critical')) continue;
      if (alert.severity === 'info') continue; // מידע לא מגיע לשולחן העבודה

      new Notification(alert.severity === 'critical' ? `🔴 ${alert.title}` : `🟠 ${alert.title}`, {
        body: alert.detail ?? '',
        tag: alert.id,
      });
    }
  }, [alerts, config, quietHours]);
}
