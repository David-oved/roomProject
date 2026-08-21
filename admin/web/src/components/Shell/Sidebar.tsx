import { NavLink } from 'react-router-dom';
import { useStore } from '../../lib/store';

/** ניווט ראשי. המונים בסרגל הם ההצדקה שלו — הם אומרים לאן ללכת עכשיו. */
export function Sidebar() {
  const { boot, connected } = useStore();
  const counts = boot?.counts;

  const item = (to: string, icon: string, label: string, badge?: number, muted?: boolean) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>
      <span className="navlink__icon">{icon}</span>
      <span>{label}</span>
      {badge ? <span className={`navlink__badge${muted ? ' muted' : ''}`}>{badge}</span> : null}
    </NavLink>
  );

  return (
    <nav className="sidebar">
      <div className="sidebar__brand">
        🛡️
        <div>
          RoomMate
          <small>קונסולת מנהל</small>
        </div>
      </div>

      <div className="sidebar__section">מעקב</div>
      {item('/', '📊', 'סקירה כללית')}
      {item('/activity', '🔴', 'פיד פעילות')}
      {item('/alerts', '🚨', 'התראות', counts?.alerts, !counts?.criticalAlerts)}

      <div className="sidebar__section">ניהול</div>
      {item('/rooms', '🏠', 'חדרים')}
      {item('/users', '👤', 'משתמשים')}
      {item('/feedback', '💬', 'משוב', counts?.feedbackNew)}
      {item('/messages', '📢', 'הודעות', counts?.unreadThreads)}

      <div className="sidebar__section">ניתוח</div>
      {item('/insights', '📈', 'תובנות')}
      {item('/reports', '📄', 'דוחות')}
      {item('/system', '⚙️', 'מערכת')}

      <div className="sidebar__footer">
        <div className="row" style={{ gap: 6 }}>
          <span className={`dot ${connected ? 'success' : 'danger'}`} />
          {connected ? 'מחובר לזרם' : 'מנותק'}
        </div>
        <div style={{ marginTop: 4 }}>
          {boot?.mode === 'live' ? 'נתונים חיים' : 'נתוני הדגמה'}
          {boot ? ` · ${boot.counts.rooms} חדרים · ${boot.counts.users} משתמשים` : ''}
        </div>
      </div>
    </nav>
  );
}
