import { balanceSpread, computeBalances, computeContributions } from './money.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  מודל העולם
 * ═══════════════════════════════════════════════════════════════
 *  לוקח את המראה הגולמית של RTDB והופך אותה למבנה אחד שכל שאר
 *  המודולים קוראים ממנו: משתמשים, חדרים, חברויות, כספים, פעילות.
 *
 *  ‼️ נבנה פעם אחת לכל שינוי בעץ (ראו cache.mjs) ולא לכל בקשה. בלי
 *     זה כל רענון של הפיד היה מחשב מחדש מאזנים לכל החדרים — בדיוק
 *     החישוב היקר ביותר כאן.
 * ═══════════════════════════════════════════════════════════════
 */

const DAY = 86_400_000;

function list(node) {
  return Object.entries(node ?? {}).map(([id, value]) => ({ ...value, id }));
}

export function buildWorld(snapshot, now = Date.now()) {
  const rawUsers = snapshot.users ?? {};
  const rawRooms = snapshot.rooms ?? {};

  /* ── משתמשים ── */
  const users = new Map();
  for (const [uid, u] of Object.entries(rawUsers)) {
    users.set(uid, {
      uid,
      displayName: u.displayName ?? '(ללא שם)',
      email: u.email ?? '',
      avatar: u.avatar ?? null,
      createdAt: u.createdAt ?? 0,
      lastActiveAt: u.lastActiveAt ?? u.createdAt ?? 0,
      pushEnabled: Boolean(u.pushEnabled),
      memberships: [], // מתמלא בלולאת החדרים
      stats: {
        itemsReported: 0,
        purchasesMade: 0,
        purchasesPending: 0,
        totalSpent: 0,
        totalBorne: 0,
        tasksCompleted: 0,
        chatMessages: 0,
        approvals: 0,
        netBalance: 0,
      },
    });
  }

  /** משתמש שמופיע כחבר בחדר אבל אין לו רשומת users — קורה אחרי מחיקה חלקית. */
  function ensureUser(uid, fallbackName, fallbackEmail) {
    if (!users.has(uid)) {
      users.set(uid, {
        uid,
        displayName: fallbackName ?? uid,
        email: fallbackEmail ?? '',
        avatar: null,
        createdAt: 0,
        lastActiveAt: 0,
        pushEnabled: false,
        orphan: true,
        memberships: [],
        stats: {
          itemsReported: 0,
          purchasesMade: 0,
          purchasesPending: 0,
          totalSpent: 0,
          totalBorne: 0,
          tasksCompleted: 0,
          chatMessages: 0,
          approvals: 0,
          netBalance: 0,
        },
      });
    }
    return users.get(uid);
  }

  /* ── חדרים ── */
  const rooms = new Map();

  for (const [code, r] of Object.entries(rawRooms)) {
    const metadata = r.metadata ?? {};
    const members = Object.entries(r.members ?? {}).map(([uid, m]) => ({ uid, ...m }));
    const activeMembers = members.filter((m) => m.status === 'active');
    const memberIds = activeMembers.map((m) => m.uid);

    const items = list(r.items);
    const purchases = list(r.purchases);
    const settlements = list(r.settlements);
    const tasks = list(r.tasks);
    const taskCompletions = list(r.taskCompletions);
    const taskTransfers = list(r.taskTransfers);
    const announcements = list(r.announcements);
    const chat = list(r.chat);
    const pendingRequests = list(r.pendingRequests).filter((p) => p.status === 'pending');

    const openItems = items.filter((i) => i.status === 'needed' || i.status === 'buying');
    const pendingPurchases = purchases.filter((p) => p.status === 'pending');

    const balances = computeBalances(purchases, settlements, memberIds);
    const contributions = computeContributions(purchases, memberIds);

    const timestamps = [
      ...items.map((i) => i.reportedAt),
      ...purchases.map((p) => p.createdAt ?? p.date),
      ...settlements.map((s) => s.date),
      ...taskCompletions.map((t) => t.completedAt),
      ...chat.map((c) => c.sentAt),
      ...announcements.map((a) => a.sentAt),
      ...members.map((m) => m.joinedAt),
    ].filter((t) => typeof t === 'number' && t > 0);

    const lastActivityAt = timestamps.length ? Math.max(...timestamps) : (metadata.createdAt ?? 0);
    const oldestOpenItemAt = openItems.length
      ? Math.min(...openItems.map((i) => i.reportedAt ?? now))
      : null;

    const room = {
      code,
      name: metadata.name ?? code,
      description: metadata.description ?? '',
      adminId: metadata.adminId ?? null,
      createdAt: metadata.createdAt ?? 0,
      members,
      activeMembers,
      memberIds,
      items,
      openItems,
      purchases,
      pendingPurchases,
      settlements,
      tasks,
      taskCompletions,
      taskTransfers,
      announcements,
      chat,
      pendingRequests,
      balances,
      contributions,
      spread: balanceSpread(balances),
      totalSpent: contributions.total,
      lastActivityAt,
      oldestOpenItemAt,
      idleDays: lastActivityAt ? Math.floor((now - lastActivityAt) / DAY) : null,
      oldestOpenItemDays: oldestOpenItemAt ? Math.floor((now - oldestOpenItemAt) / DAY) : null,
      pendingItemsValue: 0, // מתמלא בהמשך — לפי מחיר ממוצע היסטורי
    };

    /**
     * שווי משוער של המוצרים הפתוחים.
     * אין למוצר פתוח מחיר, ולכן מעריכים לפי הממוצע ההיסטורי של החדר —
     * זה מה שהופך "12 מוצרים פתוחים" למספר שאפשר לתעדף לפיו.
     */
    const avgPurchase = purchases.length
      ? Math.round(contributions.total / purchases.filter((p) => p.status !== 'rejected').length || 0)
      : 0;
    room.pendingItemsValue = openItems.length * (avgPurchase || 0);

    /* ── חברויות והצטברות סטטיסטיקה למשתמש ── */
    for (const m of members) {
      const u = ensureUser(m.uid, m.name, m.email);
      u.memberships.push({
        roomCode: code,
        roomName: room.name,
        role: m.uid === room.adminId ? 'admin' : (m.role ?? 'member'),
        status: m.status ?? 'active',
        joinedAt: m.joinedAt ?? 0,
        balance: balances[m.uid] ?? 0,
        borne: contributions.borne[m.uid] ?? 0,
        paidOut: contributions.paidOut[m.uid] ?? 0,
      });
      u.stats.netBalance += balances[m.uid] ?? 0;
      u.stats.totalBorne += contributions.borne[m.uid] ?? 0;
    }
    for (const p of pendingRequests) {
      const u = ensureUser(p.userId, p.displayName, p.email);
      u.memberships.push({
        roomCode: code,
        roomName: room.name,
        role: 'member',
        status: 'pending',
        joinedAt: p.requestedAt ?? 0,
        balance: 0,
        borne: 0,
        paidOut: 0,
      });
    }

    for (const i of items) {
      const u = users.get(i.reportedBy);
      if (u) u.stats.itemsReported++;
    }
    for (const p of purchases) {
      const u = users.get(p.boughtBy);
      if (!u) continue;
      if (p.status === 'pending') u.stats.purchasesPending++;
      if (p.status === 'approved' || p.status === 'settled') {
        u.stats.purchasesMade++;
        u.stats.totalSpent += p.amount ?? 0;
      }
      const approver = p.approvedBy ? users.get(p.approvedBy) : null;
      if (approver && (p.status === 'approved' || p.status === 'settled')) approver.stats.approvals++;
    }
    for (const t of taskCompletions) {
      const u = users.get(t.completedBy);
      if (u) u.stats.tasksCompleted++;
    }
    for (const c of chat) {
      const u = users.get(c.senderId);
      if (u) u.stats.chatMessages++;
    }

    rooms.set(code, room);
  }

  return {
    now,
    users,
    rooms,
    userList: [...users.values()],
    roomList: [...rooms.values()],
    /** גישה נוחה לשם משתמש — הרבה מאוד קוד למטה צריך רק את זה. */
    nameOf(uid) {
      return users.get(uid)?.displayName ?? uid ?? '—';
    },
    roomNameOf(code) {
      return rooms.get(code)?.name ?? code;
    },
    feedback: snapshot.feedback ?? {},
    console: snapshot.adminConsole ?? {},
  };
}
