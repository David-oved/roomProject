import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { relativeTime } from '../../lib/format';
import { Dot } from '../ui/primitives';

/**
 * שורת עליונה: חיפוש גלובלי, מצב הזרם, וגישה מהירה להתראות.
 *
 * החיפוש רץ על רשימות ה-bootstrap (חדרים ומשתמשים) — הן קטנות
 * ונמצאות כבר בזיכרון, ולכן התוצאה מיידית בלי סיבוב לשרת.
 */
export function TopBar() {
  const { boot, connected, lastPush } = useStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 1 || !boot) return [];
    const rooms = boot.rooms
      .filter((r) => r.name.toLowerCase().includes(needle) || r.code.toLowerCase().includes(needle))
      .slice(0, 6)
      .map((r) => ({ kind: 'room' as const, id: r.code, title: r.name, sub: r.code }));
    const users = boot.users
      .filter((u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle))
      .slice(0, 6)
      .map((u) => ({ kind: 'user' as const, id: u.uid, title: u.name, sub: u.email }));
    return [...rooms, ...users];
  }, [query, boot]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // ‼️ קיצור מקלדת אחד בלבד (⌘/Ctrl+K). כלי שדורש לזכור עשרה קיצורים
  //    נגמר בכך שלא זוכרים אף אחד.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        (document.getElementById('global-search') as HTMLInputElement | null)?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (kind: 'room' | 'user', id: string) => {
    setQuery('');
    setOpen(false);
    navigate(kind === 'room' ? `/rooms/${id}` : `/users/${id}`);
  };

  return (
    <header className="topbar">
      <div className="topbar__search" ref={boxRef}>
        <input
          id="global-search"
          className="input"
          type="search"
          placeholder="חיפוש חדר או משתמש…  (⌘K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {open && results.length > 0 && (
          <div
            className="card"
            style={{ position: 'absolute', top: 40, insetInlineStart: 0, width: '100%', zIndex: 40 }}
          >
            <div className="card__body tight">
              {results.map((r) => (
                <button
                  key={`${r.kind}-${r.id}`}
                  className="feed__item"
                  style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}
                  onClick={() => go(r.kind, r.id)}
                >
                  <span className="feed__icon">{r.kind === 'room' ? '🏠' : '👤'}</span>
                  <span className="feed__body" style={{ textAlign: 'start' }}>
                    <span className="bold">{r.title}</span>
                    <span className="feed__meta">{r.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="topbar__spacer" />

      {boot?.quietHours && <span className="badge neutral">🌙 שעות שקט</span>}
      {boot?.mode === 'demo' && <span className="badge warn">מצב הדגמה</span>}

      <span className="row tiny muted" style={{ gap: 6 }}>
        <Dot tone={connected ? 'success' : 'danger'} live={connected} />
        {connected ? `עודכן ${relativeTime(lastPush?.builtAt ?? Date.now())}` : 'אין חיבור לשרת'}
      </span>
    </header>
  );
}
