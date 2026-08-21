import { assessAllRooms } from './roomHealth.mjs';
import { agorot } from './money.mjs';
import { feedbackAnalytics } from './feedback.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  דוחות
 * ═══════════════════════════════════════════════════════════════
 *  כל דוח מוחזר כמבנה אחיד: כותרת, תקופה, כרטיסי סיכום, וטבלאות.
 *  המבנה האחיד הוא מה שמאפשר למסך אחד להציג כל דוח, ולייצוא אחד
 *  (CSV/JSON) לעבוד על כולם בלי מקרים פרטיים.
 * ═══════════════════════════════════════════════════════════════
 */

const DAY = 86_400_000;

export const REPORT_TYPES = {
  daily: { label: 'סיכום יומי', description: 'מי היה פעיל, מה דווח, מה נקנה, איך זזו המאזנים' },
  weekly: { label: 'דוח שבועי', description: 'פילוח לפי חדר, מעורבות משתמשים ומגמות' },
  financial: { label: 'סיכום כספי חודשי', description: 'הוצאות לפי חדר וקטגוריה, מגמה חודשית' },
  behavior: { label: 'ניתוח התנהגות משתמשים', description: 'פעילים/רדומים, מעורבות, פיצ׳רים בשימוש' },
  health: { label: 'דוח בריאות חדרים', description: 'ציונים, בעיות והמלצות לכל חדר' },
  feedback: { label: 'סיכום משוב', description: 'נושאים פתוחים, בקשות פיצ׳רים וסנטימנט' },
  custom: { label: 'דוח מותאם', description: 'בחירת מדדים, תקופה וקיבוץ' },
};

function table(title, columns, rows) {
  return { title, columns, rows };
}

/** ברירת מחדל לתקופה לפי סוג הדוח — "סיכום יומי" ל-30 יום הוא באג. */
const DEFAULT_DAYS = { daily: 1, weekly: 7, financial: 30, behavior: 30, health: 30, feedback: 30, custom: 30 };

function periodOf(range, now, type = 'custom') {
  const days = range?.days ?? DEFAULT_DAYS[type] ?? 30;
  const from = range?.from ?? now - days * DAY;
  const to = range?.to ?? now;
  return { from, to, days: Math.max(1, Math.round((to - from) / DAY)) };
}

function eventsIn(events, period) {
  return events.filter((e) => e.ts >= period.from && e.ts <= period.to);
}

export function generateReport(type, { world, events, analytics, feedbackItems, range, metrics, groupBy }) {
  const period = periodOf(range, world.now, type);
  const scoped = eventsIn(events, period);

  switch (type) {
    case 'daily':
      return dailyReport(world, scoped, period);
    case 'weekly':
      return weeklyReport(world, scoped, period);
    case 'financial':
      return financialReport(world, period);
    case 'behavior':
      return behaviorReport(world, analytics, period);
    case 'health':
      return healthReport(world, period);
    case 'feedback':
      return feedbackReport(world, feedbackItems, period);
    case 'custom':
      return customReport(world, scoped, analytics, period, metrics ?? [], groupBy ?? 'room');
    default:
      throw new Error(`סוג דוח לא מוכר: ${type}`);
  }
}

function dailyReport(world, scoped, period) {
  const acts = scoped.filter((e) => e.category !== 'session');
  const purchases = scoped.filter((e) => e.type === 'purchase_made');
  const spend = purchases.reduce((a, e) => a + (e.amount ?? 0), 0);
  const activeUsers = new Set(acts.map((e) => e.actorId));

  return {
    type: 'daily',
    title: 'סיכום יומי',
    period,
    cards: [
      { label: 'משתמשים פעילים', value: activeUsers.size },
      { label: 'פעולות', value: acts.length },
      { label: 'מוצרים דווחו', value: scoped.filter((e) => e.type === 'item_reported').length },
      { label: 'קניות', value: purchases.length },
      { label: 'סך הוצאה', value: agorot.format(spend) },
      { label: 'משוב חדש', value: scoped.filter((e) => e.category === 'feedback').length },
    ],
    tables: [
      table(
        'פעילות לפי חדר',
        ['חדר', 'פעולות', 'קניות', 'הוצאה'],
        world.roomList.map((r) => {
          const inRoom = acts.filter((e) => e.roomCode === r.code);
          const buys = inRoom.filter((e) => e.type === 'purchase_made');
          return [
            `${r.name} (${r.code})`,
            inRoom.length,
            buys.length,
            agorot.format(buys.reduce((a, e) => a + (e.amount ?? 0), 0)),
          ];
        })
      ),
      table(
        'הפעולות בתקופה',
        ['שעה', 'משתמש', 'חדר', 'פעולה'],
        acts
          .slice(0, 100)
          .map((e) => [
            new Date(e.ts).toLocaleString('he-IL'),
            e.actorName ?? '—',
            e.roomName ?? '—',
            e.text,
          ])
      ),
    ],
  };
}

function weeklyReport(world, scoped, period) {
  const acts = scoped.filter((e) => e.category !== 'session');
  const byUser = new Map();
  for (const e of acts) byUser.set(e.actorId, (byUser.get(e.actorId) ?? 0) + 1);

  return {
    type: 'weekly',
    title: 'דוח שבועי',
    period,
    cards: [
      { label: 'פעולות', value: acts.length },
      { label: 'משתמשים פעילים', value: byUser.size },
      { label: 'חדרים פעילים', value: new Set(acts.map((e) => e.roomCode).filter(Boolean)).size },
      {
        label: 'ממוצע פעולות למשתמש',
        value: byUser.size ? Math.round((acts.length / byUser.size) * 10) / 10 : 0,
      },
    ],
    tables: [
      table(
        'מעורבות משתמשים',
        ['משתמש', 'פעולות', 'חדרים', 'פעיל לאחרונה'],
        [...byUser.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([uid, count]) => {
            const u = world.users.get(uid);
            return [
              world.nameOf(uid),
              count,
              u?.memberships.filter((m) => m.status === 'active').length ?? 0,
              u?.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString('he-IL') : '—',
            ];
          })
      ),
      table(
        'פילוח סוגי פעולות',
        ['סוג', 'כמות'],
        Object.entries(
          acts.reduce((acc, e) => {
            acc[e.category] = (acc[e.category] ?? 0) + 1;
            return acc;
          }, {})
        ).sort((a, b) => b[1] - a[1])
      ),
    ],
  };
}

function financialReport(world, period) {
  let total = 0;
  const rows = [];
  const byCategory = {};

  for (const room of world.roomList) {
    const inPeriod = room.purchases.filter(
      (p) =>
        (p.status === 'approved' || p.status === 'settled') &&
        (p.createdAt ?? p.date) >= period.from &&
        (p.createdAt ?? p.date) <= period.to
    );
    const sum = inPeriod.reduce((a, p) => a + p.amount, 0);
    total += sum;
    rows.push([
      `${room.name} (${room.code})`,
      inPeriod.length,
      agorot.format(sum),
      agorot.format(inPeriod.length ? Math.round(sum / inPeriod.length) : 0),
      agorot.format(room.spread),
    ]);
    for (const p of inPeriod) {
      const key = p.splitMethod === 'covered' ? 'לקח על עצמו' : 'חלוקה משותפת';
      byCategory[key] = (byCategory[key] ?? 0) + p.amount;
    }
  }

  return {
    type: 'financial',
    title: 'סיכום כספי',
    period,
    cards: [
      { label: 'סך הוצאות', value: agorot.format(total) },
      { label: 'חדרים פעילים כספית', value: rows.filter((r) => r[1] > 0).length },
      {
        label: 'ממוצע לחדר',
        value: agorot.format(world.roomList.length ? Math.round(total / world.roomList.length) : 0),
      },
    ],
    tables: [
      table('הוצאות לפי חדר', ['חדר', 'קניות', 'סך הכל', 'ממוצע לקנייה', 'פער מאזנים'], rows),
      table(
        'לפי שיטת חלוקה',
        ['שיטה', 'סכום'],
        Object.entries(byCategory).map(([k, v]) => [k, agorot.format(v)])
      ),
    ],
  };
}

function behaviorReport(world, analytics, period) {
  const t = analytics.totals;
  return {
    type: 'behavior',
    title: 'ניתוח התנהגות משתמשים',
    period,
    cards: [
      { label: 'משתמשים', value: t.users },
      { label: 'פעילים (7 ימים)', value: `${t.activeNow} (${t.activePercent}%)` },
      { label: 'נטישה', value: `${t.churned} (${t.churnPercent}%)` },
      { label: 'סשן ממוצע (הערכה)', value: `${Math.round(t.avgSessionMs / 60000)} דק׳` },
      { label: 'שעת שיא', value: `${analytics.peakHour}:00` },
    ],
    tables: [
      table(
        'שימוש בפיצ׳רים',
        ['פיצ׳ר', 'משתמשים', 'אחוז'],
        analytics.featureUsage.map((f) => [f.feature, f.users, `${f.percent}%`])
      ),
      table(
        'משתמשים',
        ['משתמש', 'פעולות בחלון', 'ימים פעילים', 'חדרים', 'פלחים'],
        analytics.profiles
          .sort((a, b) => b.window.actions - a.window.actions)
          .map((p) => [
            p.displayName,
            p.window.actions,
            p.window.activeDays,
            p.roomsCount,
            p.segments.join(', '),
          ])
      ),
    ],
  };
}

function healthReport(world, period) {
  const health = assessAllRooms(world);
  return {
    type: 'health',
    title: 'בריאות חדרים',
    period,
    cards: [
      { label: 'חדרים', value: health.length },
      { label: 'תקינים', value: health.filter((h) => h.level === 'healthy').length },
      { label: 'בסיכון', value: health.filter((h) => h.level === 'risk').length },
      { label: 'קריטיים', value: health.filter((h) => h.level === 'critical').length },
    ],
    tables: [
      table(
        'ציונים',
        ['חדר', 'ציון', 'מצב', 'חברים', 'פתוחים', 'ממתינות לאישור', 'פער מאזנים', 'ימים ללא פעילות'],
        health.map((h) => [
          `${h.name} (${h.code})`,
          h.score,
          { healthy: 'תקין', risk: 'בסיכון', critical: 'קריטי' }[h.level],
          `${h.membersActive}/${h.membersTotal}`,
          h.openItems,
          h.pendingPurchases,
          agorot.format(h.spread),
          h.idleDays ?? 0,
        ])
      ),
      table(
        'בעיות פתוחות',
        ['חדר', 'חומרה', 'בעיה', 'פירוט'],
        health.flatMap((h) =>
          h.issues.map((i) => [
            h.name,
            i.severity === 'critical' ? 'קריטי' : 'אזהרה',
            i.title,
            i.detail ?? '',
          ])
        )
      ),
    ],
  };
}

function feedbackReport(world, feedbackItems, period) {
  const inPeriod = feedbackItems.filter((f) => f.createdAt >= period.from && f.createdAt <= period.to);
  const analytics = feedbackAnalytics(feedbackItems, world);

  return {
    type: 'feedback',
    title: 'סיכום משוב',
    period,
    cards: [
      { label: 'משוב בתקופה', value: inPeriod.length },
      { label: 'פתוחים', value: feedbackItems.filter((f) => ['new', 'read', 'in_progress'].includes(f.status)).length },
      { label: 'סנטימנט', value: `${analytics.sentiment > 0 ? '+' : ''}${analytics.sentiment}` },
      { label: 'אחוז מענה', value: `${analytics.responseRate}%` },
    ],
    tables: [
      table(
        'לפי סוג',
        ['סוג', 'כמות'],
        Object.entries(analytics.byType).sort((a, b) => b[1] - a[1])
      ),
      table('לפי חדר', ['חדר', 'כמות'], analytics.byRoom.map((r) => [r.name ?? r.code, r.count])),
      table(
        'פריטים',
        ['תאריך', 'חדר', 'שולח', 'סוג', 'נושא', 'סטטוס', 'עדיפות'],
        inPeriod.map((f) => [
          new Date(f.createdAt).toLocaleDateString('he-IL'),
          f.roomName ?? '—',
          f.userName,
          f.typeLabel,
          f.subject,
          f.status,
          f.priority,
        ])
      ),
    ],
  };
}

/** בונה דוח מהמדדים שסימנתי במסך. */
function customReport(world, scoped, analytics, period, metrics, groupBy) {
  const acts = scoped.filter((e) => e.category !== 'session');
  const cards = [];

  const add = (key, label, value) => {
    if (metrics.length === 0 || metrics.includes(key)) cards.push({ label, value });
  };

  add('users_active', 'משתמשים פעילים', new Set(acts.map((e) => e.actorId)).size);
  add('rooms_active', 'חדרים פעילים', new Set(acts.map((e) => e.roomCode).filter(Boolean)).size);
  add('items', 'מוצרים שדווחו', acts.filter((e) => e.type === 'item_reported').length);
  add('purchases', 'קניות', acts.filter((e) => e.type === 'purchase_made').length);
  add(
    'spend',
    'סך הוצאה',
    agorot.format(acts.filter((e) => e.type === 'purchase_made').reduce((a, e) => a + (e.amount ?? 0), 0))
  );
  add('feedback', 'משוב', acts.filter((e) => e.category === 'feedback').length);
  add('tasks', 'מטלות שבוצעו', acts.filter((e) => e.type === 'task_completed').length);
  add('messages', 'הודעות צ׳אט', acts.filter((e) => e.category === 'chat').length);

  const groups = new Map();
  for (const e of acts) {
    let key;
    if (groupBy === 'user') key = e.actorName ?? '—';
    else if (groupBy === 'day') key = new Date(e.ts).toLocaleDateString('he-IL');
    else if (groupBy === 'category') key = e.category;
    else key = e.roomName ?? '—';
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  return {
    type: 'custom',
    title: 'דוח מותאם',
    period,
    cards,
    tables: [
      table(
        `קיבוץ לפי ${{ room: 'חדר', user: 'משתמש', day: 'יום', category: 'סוג פעולה' }[groupBy]}`,
        ['ערך', 'פעולות'],
        [...groups.entries()].sort((a, b) => b[1] - a[1])
      ),
    ],
  };
}

/* ═══════════ ייצוא ═══════════ */

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToCsv(report) {
  const lines = [`# ${report.title}`];
  lines.push(
    `# תקופה: ${new Date(report.period.from).toLocaleDateString('he-IL')} — ${new Date(
      report.period.to
    ).toLocaleDateString('he-IL')}`
  );
  lines.push('');
  lines.push('סיכום');
  for (const c of report.cards) lines.push(`${csvCell(c.label)},${csvCell(c.value)}`);

  for (const t of report.tables) {
    lines.push('');
    lines.push(csvCell(t.title));
    lines.push(t.columns.map(csvCell).join(','));
    for (const row of t.rows) lines.push(row.map(csvCell).join(','));
  }
  // BOM — בלעדיו Excel פותח עברית כג׳יבריש
  return '﻿' + lines.join('\n');
}

/** HTML להדפסה/PDF — הדפדפן הוא מנוע ה-PDF, בלי תלות חיצונית. */
export function reportToHtml(report) {
  const esc = (s) =>
    String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>${esc(report.title)}</title>
<style>
  body { font-family: system-ui, "Segoe UI", Arial, sans-serif; margin: 32px; color: #1f2937; }
  h1 { color: #1e3a8a; font-size: 24px; margin-bottom: 4px; }
  .period { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 28px; }
  .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; min-width: 140px; }
  .card .label { font-size: 12px; color: #6b7280; }
  .card .value { font-size: 20px; font-weight: 700; color: #1e3a8a; }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: right; }
  th { background: #f3f4f6; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>${esc(report.title)}</h1>
<div class="period">${new Date(report.period.from).toLocaleDateString('he-IL')} — ${new Date(
    report.period.to
  ).toLocaleDateString('he-IL')}</div>
<div class="cards">${report.cards
    .map((c) => `<div class="card"><div class="label">${esc(c.label)}</div><div class="value">${esc(c.value)}</div></div>`)
    .join('')}</div>
${report.tables
  .map(
    (t) => `<h2>${esc(t.title)}</h2><table><thead><tr>${t.columns
      .map((c) => `<th>${esc(c)}</th>`)
      .join('')}</tr></thead><tbody>${t.rows
      .map((r) => `<tr>${r.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`
  )
  .join('')}
</body></html>`;
}
