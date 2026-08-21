/**
 * ═══════════════════════════════════════════════════════════════
 *  נתוני הדגמה
 * ═══════════════════════════════════════════════════════════════
 *  מבנה זהה לחלוטין ל-RTDB האמיתי (ראו database.rules.json), כדי
 *  שכל קוד הניתוח ירוץ על שניהם בלי שום הסתעפות.
 *
 *  הנתונים נבנים דטרמיניסטית (RNG עם זרע קבוע) — שתי הרצות מייצרות
 *  בדיוק אותו עולם, אחרת אי אפשר לבדוק מסכים שמציגים מספרים.
 *
 *  העולם המדומה בנוי סביב שלושה מצבי חדר שהקונסולה צריכה לזהות:
 *  חדר בריא, חדר בסיכון, וחדר נטוש — ראו roomHealth.mjs.
 * ═══════════════════════════════════════════════════════════════
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

function mulberry32(seed) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PEOPLE = [
  ['u_david', 'דוד לוי', 'david@example.com'],
  ['u_shalom', 'שלום כהן', 'shalom@example.com'],
  ['u_yael', 'יעל אברהם', 'yael@example.com'],
  ['u_roi', 'רועי מזרחי', 'roi@example.com'],
  ['u_noa', 'נועה פרץ', 'noa@example.com'],
  ['u_itay', 'איתי שרון', 'itay@example.com'],
  ['u_maya', 'מאיה גולן', 'maya@example.com'],
  ['u_omer', 'עומר בן דוד', 'omer@example.com'],
  ['u_shir', 'שיר נחום', 'shir@example.com'],
  ['u_tal', 'טל רוזן', 'tal@example.com'],
  ['u_uri', 'אורי דהן', 'uri@example.com'],
  ['u_rotem', 'רותם ביטון', 'rotem@example.com'],
  ['u_adi', 'עדי חדד', 'adi@example.com'],
  ['u_lior', 'ליאור אלון', 'lior@example.com'],
];

const PRODUCTS = [
  ['חלב', 'kitchen', 720],
  ['לחם', 'kitchen', 1200],
  ['ביצים', 'kitchen', 1890],
  ['נייר טואלט', 'bathroom', 3400],
  ['סבון כלים', 'cleaning', 1450],
  ['שקיות זבל', 'cleaning', 2200],
  ['קפה', 'kitchen', 3900],
  ['אקונומיקה', 'cleaning', 990],
  ['שמפו', 'bathroom', 2750],
  ['סוכר', 'kitchen', 640],
  ['מגבות נייר', 'cleaning', 1800],
  ['גבינה צהובה', 'kitchen', 2450],
];

const ROOM_BLUEPRINTS = [
  {
    code: 'AB2K7Q',
    name: 'מעונות 205',
    description: 'שלושה סטודנטים ומקרר אחד',
    health: 'healthy',
    members: ['u_david', 'u_shalom', 'u_noa', 'u_itay'],
    admin: 'u_david',
    ageDays: 210,
    purchases: 46,
    openItems: 1,
    lastActivityMinutes: 2,
    pendingRequests: 0,
  },
  {
    code: 'CD4RM8',
    name: 'דירת שותפים רמת גן',
    description: 'שמונה שותפים, מטבח אחד, הרבה קפה',
    health: 'risk',
    members: ['u_yael', 'u_maya', 'u_omer', 'u_shir', 'u_tal', 'u_uri', 'u_rotem', 'u_shalom'],
    admin: 'u_yael',
    ageDays: 160,
    purchases: 61,
    openItems: 3,
    oldestItemDays: 8,
    lastActivityMinutes: 5 * 60,
    pendingRequests: 1,
    pendingPurchases: 2,
    imbalance: 45_000,
  },
  {
    code: 'EF5TP3',
    name: 'מעונות 201',
    description: 'החדר שכולם שכחו',
    health: 'critical',
    members: ['u_roi', 'u_adi', 'u_lior', 'u_david', 'u_noa'],
    admin: 'u_roi',
    ageDays: 300,
    purchases: 38,
    openItems: 12,
    oldestItemDays: 45,
    lastActivityMinutes: 34 * 24 * 60,
    pendingRequests: 0,
    imbalance: 240_000,
  },
  {
    code: 'GH7WS6',
    name: 'מעונות 105',
    description: 'שלושה, רגועים',
    health: 'healthy',
    members: ['u_itay', 'u_shir', 'u_tal'],
    admin: 'u_itay',
    ageDays: 95,
    purchases: 22,
    openItems: 2,
    lastActivityMinutes: 26 * 60,
    pendingRequests: 0,
  },
  {
    code: 'JK9XN4',
    name: 'דירת הגן',
    description: 'חדר חדש, עוד לומדים את המערכת',
    health: 'new',
    members: ['u_maya', 'u_omer', 'u_rotem', 'u_lior', 'u_adi', 'u_uri'],
    admin: 'u_maya',
    ageDays: 24,
    purchases: 14,
    openItems: 2,
    lastActivityMinutes: 40,
    pendingRequests: 2,
  },
];

export function buildSeed(now = Date.now()) {
  const rng = mulberry32(20260821);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const between = (min, max) => Math.floor(min + rng() * (max - min));

  const users = {};
  for (const [uid, displayName, email] of PEOPLE) {
    users[uid] = {
      email,
      displayName,
      avatar: null,
      createdAt: now - between(30, 320) * DAY,
      lastActiveAt: now - between(1, 40) * HOUR,
      rooms: {},
    };
  }
  // משתמשים רדומים — הקונסולה חייבת לזהות אותם כפלח נפרד
  users.u_lior.lastActiveAt = now - 47 * DAY;
  users.u_adi.lastActiveAt = now - 96 * DAY;
  users.u_roi.lastActiveAt = now - 21 * DAY;
  users.u_david.lastActiveAt = now - 2 * MINUTE;
  users.u_shalom.lastActiveAt = now - 18 * MINUTE;

  const rooms = {};
  const roomCodes = {};
  const roomNames = {};

  for (const bp of ROOM_BLUEPRINTS) {
    const createdAt = now - bp.ageDays * DAY;
    const lastActivity = now - (bp.lastActivityMinutes ?? 120) * MINUTE;

    const members = {};
    bp.members.forEach((uid, i) => {
      members[uid] = {
        name: users[uid].displayName,
        email: users[uid].email,
        avatar: null,
        joinedAt: createdAt + i * between(1, 5) * DAY,
        status: 'active',
        role: uid === bp.admin ? 'admin' : 'member',
      };
      users[uid].rooms[bp.code] = true;
    });

    /* ── קניות ── */
    const purchases = {};
    let seq = 0;
    for (let i = 0; i < bp.purchases; i++) {
      seq++;
      const [title, , basePrice] = pick(PRODUCTS);
      const buyer = pick(bp.members);
      const date = createdAt + Math.floor(rng() * (lastActivity - createdAt));
      const amount = Math.max(300, Math.round((basePrice * (0.7 + rng() * 0.8)) / 10) * 10);
      const method = rng() < 0.18 ? 'covered' : 'equal';
      const participants = method === 'covered' ? [buyer] : bp.members;
      const shares = splitEqual(amount, participants);
      purchases[`p_${bp.code}_${seq}`] = {
        itemId: null,
        title,
        boughtBy: buyer,
        amount,
        date,
        createdAt: date,
        splitMethod: method,
        splitBetween: Object.fromEntries(participants.map((u) => [u, true])),
        shares,
        receipt: null,
        status: 'approved',
        approvedBy: bp.admin,
      };
    }

    // קניות שממתינות לאישור — מקור מרכזי ל"חדר שדורש טיפול"
    for (let i = 0; i < (bp.pendingPurchases ?? 0); i++) {
      seq++;
      const [title, , basePrice] = pick(PRODUCTS);
      const buyer = pick(bp.members.filter((u) => u !== bp.admin));
      const amount = Math.round(basePrice * (0.8 + rng() * 0.6));
      purchases[`p_${bp.code}_${seq}`] = {
        itemId: null,
        title,
        boughtBy: buyer,
        amount,
        date: now - between(2, 6) * DAY,
        createdAt: now - between(2, 6) * DAY,
        splitMethod: 'equal',
        splitBetween: Object.fromEntries(bp.members.map((u) => [u, true])),
        shares: splitEqual(amount, bp.members),
        receipt: null,
        status: 'pending',
        approvedBy: null,
      };
    }

    /* ── חוסר איזון מכוון ── */
    if (bp.imbalance) {
      seq++;
      const heavyBuyer = bp.members[0];
      purchases[`p_${bp.code}_${seq}`] = {
        itemId: null,
        title: 'קנייה גדולה לחודש',
        boughtBy: heavyBuyer,
        amount: bp.imbalance,
        date: now - between(20, 50) * DAY,
        createdAt: now - between(20, 50) * DAY,
        splitMethod: 'equal',
        splitBetween: Object.fromEntries(bp.members.map((u) => [u, true])),
        shares: splitEqual(bp.imbalance, bp.members),
        receipt: null,
        status: 'approved',
        approvedBy: bp.admin,
      };
    }

    /* ── פריטים פתוחים ── */
    const items = {};
    const oldest = bp.oldestItemDays ?? 4;
    for (let i = 0; i < bp.openItems; i++) {
      const [name, category] = pick(PRODUCTS);
      const ageDays = bp.openItems === 1 ? 1 : Math.round((oldest / bp.openItems) * (i + 1));
      // ‼️ מוצר פתוח לעולם לא חדש מהפעילות האחרונה של החדר — אחרת חדר
      //    "נטוש" היה נראה פעיל רק בגלל הדיווחים שנשארו תלויים בו.
      const reportedAt = Math.min(now - ageDays * DAY, lastActivity - i * HOUR);
      items[`i_${bp.code}_${i + 1}`] = {
        name,
        nameLower: name,
        category,
        reportedBy: pick(bp.members),
        reportedAt,
        priority: rng() < 0.2 ? 'high' : 'normal',
        status: 'needed',
        assignedTo: null,
        notes: null,
        purchaseId: null,
      };
    }
    // פריטים סגורים לאורך ההיסטוריה, כדי שיומן החדר לא יהיה ריק
    for (let i = 0; i < 12; i++) {
      const [name, category] = pick(PRODUCTS);
      const reportedAt = createdAt + Math.floor(rng() * (lastActivity - createdAt));
      items[`i_${bp.code}_done_${i + 1}`] = {
        name,
        nameLower: name,
        category,
        reportedBy: pick(bp.members),
        reportedAt,
        priority: 'normal',
        status: 'done',
        assignedTo: pick(bp.members),
        notes: null,
        purchaseId: null,
      };
    }

    /* ── סגירות חשבון ── */
    const settlements = {};
    for (let i = 0; i < (bp.health === 'healthy' ? 5 : 1); i++) {
      const from = pick(bp.members);
      const to = pick(bp.members.filter((u) => u !== from));
      settlements[`s_${bp.code}_${i + 1}`] = {
        from,
        to,
        amount: between(1500, 9000),
        date: now - between(3, 60) * DAY,
        confirmedBy: to,
      };
    }

    /* ── מטלות ── */
    const tasks = {};
    const taskCompletions = {};
    ['ניקיון מטבח', 'הוצאת זבל', 'ניקיון שירותים'].forEach((name, idx) => {
      const participants = bp.members.slice(0, Math.min(4, bp.members.length));
      tasks[`t_${bp.code}_${idx + 1}`] = {
        name,
        category: idx === 2 ? 'bathroom' : 'cleaning',
        intervalDays: [3, 7, 14][idx],
        participants,
        currentAssignee: participants[idx % participants.length],
        dueAt: now + between(-6, 6) * DAY,
        createdBy: bp.admin,
        createdAt: createdAt + DAY,
      };
      for (let c = 0; c < (bp.health === 'critical' ? 2 : 9); c++) {
        const id = `tc_${bp.code}_${idx}_${c}`;
        taskCompletions[id] = {
          taskId: `t_${bp.code}_${idx + 1}`,
          taskName: name,
          completedBy: pick(participants),
          completedAt: lastActivity - c * between(2, 9) * DAY,
        };
      }
    });

    /* ── בקשות הצטרפות ממתינות ── */
    const pendingRequests = {};
    for (let i = 0; i < (bp.pendingRequests ?? 0); i++) {
      const candidate = PEOPLE.map((p) => p[0]).find(
        (uid) => !bp.members.includes(uid) && !pendingRequests[uid]
      );
      if (!candidate) break;
      pendingRequests[candidate] = {
        userId: candidate,
        displayName: users[candidate].displayName,
        email: users[candidate].email,
        avatar: null,
        requestedAt: now - between(1, 5) * DAY,
        status: 'pending',
        respondedAt: null,
      };
    }

    /* ── שיחה ושידורים ── */
    const chat = {};
    const chatLines = [
      'מישהו לוקח חלב בדרך הביתה?',
      'קניתי, העליתי למערכת',
      'תזכורת: תורנות זבל היום',
      'אפשר לאשר לי את הקנייה מאתמול?',
      'נגמר הנייר טואלט 😅',
      'אני מסדר את המטבח בערב',
    ];
    for (let i = 0; i < 8; i++) {
      chat[`c_${bp.code}_${i + 1}`] = {
        senderId: pick(bp.members),
        text: pick(chatLines),
        sentAt: lastActivity - i * between(20, 300) * MINUTE,
      };
    }

    const announcements = {
      [`an_${bp.code}_1`]: {
        senderId: bp.admin,
        text: 'חברים, נא לעדכן קניות באותו יום — אחרת המאזן מתבלגן',
        sentAt: lastActivity - 3 * DAY,
      },
    };

    const notifications = {};
    let notifIdx = 0;
    for (const [pid, p] of Object.entries(purchases).slice(-8)) {
      notifIdx++;
      notifications[`n_${bp.code}_${notifIdx}`] = {
        type: p.status === 'pending' ? 'purchase_made' : 'purchase_approved',
        actorId: p.boughtBy,
        actorName: users[p.boughtBy].displayName,
        text: `${users[p.boughtBy].displayName} קנה ${p.title}`,
        entityId: pid,
        createdAt: p.createdAt,
      };
    }

    const balances = {};
    const computed = computeBalances(Object.values(purchases), Object.values(settlements), bp.members);
    for (const [uid, amount] of Object.entries(computed)) {
      balances[uid] = { amount, lastUpdated: lastActivity };
    }

    rooms[bp.code] = {
      metadata: {
        name: bp.name,
        description: bp.description,
        photo: null,
        categories: { kitchen: true, cleaning: true, bathroom: true },
        currency: 'ILS',
        createdAt,
        createdBy: bp.admin,
        adminId: bp.admin,
      },
      members,
      items,
      purchases,
      settlements,
      balances,
      notifications,
      tasks,
      taskCompletions,
      announcements,
      chat,
      ...(Object.keys(pendingRequests).length ? { pendingRequests } : {}),
    };

    roomCodes[bp.code] = { name: bp.name, adminId: bp.admin, createdAt };
    roomNames[bp.name.replace(/\s+/g, '-')] = bp.code;
  }

  /* ── משוב מהחדרים ── */
  const feedback = {
    fb_1: {
      roomCode: 'AB2K7Q',
      userId: 'u_david',
      type: 'bug',
      subject: 'לוח המחוונים לא נטען בנייד',
      body:
        'כשאני פותח את האפליקציה בטלפון, אזור המאזנים שבור. הכפתורים לא מגיבים. קורה בכל פעם.',
      environment: { device: 'iPhone 12', browser: 'Safari', os: 'iOS 16.2', appVersion: '1.21.0' },
      attachments: [{ name: 'screenshot_01.jpg', size: 125_952 }],
      createdAt: now - 4 * HOUR,
    },
    fb_2: {
      roomCode: 'CD4RM8',
      userId: 'u_shalom',
      type: 'feature',
      subject: 'להוסיף מוצרים חוזרים',
      body: 'יהיה מעולה אם אפשר יהיה להגדיר מוצר שחוזר — חלב כל 3 ימים, ניקיון כל שבוע.',
      environment: { device: 'Pixel 7', browser: 'Chrome', os: 'Android 14', appVersion: '1.20.0' },
      attachments: [],
      createdAt: now - 30 * HOUR,
    },
    fb_3: {
      roomCode: 'JK9XN4',
      userId: 'u_maya',
      type: 'question',
      subject: 'איך מחלקים בחלוקה מותאמת?',
      body: 'איך אני מחלקת מוצר של ₪100 כ-₪60/₪40 בין שניים?',
      environment: { device: 'Galaxy S22', browser: 'Chrome', os: 'Android 13', appVersion: '1.21.0' },
      attachments: [],
      createdAt: now - 2 * DAY,
    },
    fb_4: {
      roomCode: 'EF5TP3',
      userId: 'u_roi',
      type: 'issue',
      subject: 'המאזן שלי לא מסתדר',
      body: 'אני בטוח ששילמתי, אבל המערכת עדיין מציגה חוב של יותר מ-₪500.',
      environment: { device: 'iPhone 13', browser: 'Safari', os: 'iOS 17.1', appVersion: '1.19.0' },
      attachments: [],
      createdAt: now - 5 * DAY,
    },
    fb_5: {
      roomCode: 'GH7WS6',
      userId: 'u_itay',
      type: 'compliment',
      subject: 'תודה על סבב המטלות',
      body: 'הרוטציה של המטלות פתרה לנו ריב קבוע בדירה. תודה!',
      environment: { device: 'MacBook', browser: 'Chrome', os: 'macOS 14', appVersion: '1.21.0' },
      attachments: [],
      createdAt: now - 8 * DAY,
    },
    fb_6: {
      roomCode: 'CD4RM8',
      userId: 'u_omer',
      type: 'bug',
      subject: 'התראות פוש לא מגיעות',
      body: 'הפעלתי התראות אבל לא קיבלתי כלום כבר שבוע.',
      environment: { device: 'iPhone 11', browser: 'Safari', os: 'iOS 16.6', appVersion: '1.18.1' },
      attachments: [],
      createdAt: now - 11 * DAY,
    },
  };

  /* ── מצב הקונסולה עצמה ── */
  const adminConsole = {
    feedbackState: {
      fb_2: {
        status: 'read',
        priority: 'medium',
        category: 'feature',
        notes: {
          note_1: {
            text: 'רעיון טוב. לשקול ל-2.2 יחד עם מוצרי הבסיס.',
            createdAt: now - 20 * HOUR,
          },
        },
        updatedAt: now - 20 * HOUR,
      },
      fb_5: { status: 'resolved', priority: 'low', category: 'compliment', updatedAt: now - 7 * DAY },
    },
    templates: {
      tpl_maintenance: {
        name: 'תחזוקה מתוכננת',
        title: 'תחזוקה הלילה',
        body: 'בין 02:00 ל-04:00 המערכת תהיה בתחזוקה. ייתכן שהאפליקציה לא תהיה זמינה. תודה על הסבלנות!',
        kind: 'warning',
        createdAt: now - 40 * DAY,
      },
      tpl_welcome: {
        name: 'ברוכים הבאים',
        title: 'ברוכים הבאים ל-RoomMate',
        body: 'שמחים שהצטרפתם! כדאי להתחיל מדיווח מוצר חסר ומהזמנת השותפים לחדר.',
        kind: 'info',
        createdAt: now - 40 * DAY,
      },
      tpl_feedback_ack: {
        name: 'תשובה למשוב',
        title: 'קיבלנו את המשוב שלך',
        body: 'תודה שדיווחת! הנושא נמצא אצלנו בטיפול ונעדכן ברגע שיהיה חדש.',
        kind: 'info',
        createdAt: now - 30 * DAY,
      },
      tpl_room_alert: {
        name: 'חדר דורש טיפול',
        title: 'החדר שלכם צריך תשומת לב',
        body: 'יש בחדר מוצרים פתוחים כבר תקופה ארוכה. שווה לעבור עליהם ולסגור.',
        kind: 'warning',
        createdAt: now - 12 * DAY,
      },
    },
    messages: {
      msg_1: {
        title: 'תחזוקה מתוכננת',
        body: 'בין 02:00 ל-04:00 המערכת תהיה בתחזוקה. תודה על הסבלנות!',
        kind: 'warning',
        audience: { type: 'all' },
        cta: { text: 'פרטים', url: 'https://status.example.com' },
        createdAt: now - 3 * DAY,
        sendAt: now - 3 * DAY,
        status: 'sent',
        recipients: Object.fromEntries(
          PEOPLE.map(([uid], i) => [
            uid,
            {
              deliveredAt: now - 3 * DAY + 40_000,
              readAt: i % 4 === 3 ? null : now - 3 * DAY + (i + 1) * 7 * MINUTE,
              clickedAt: i % 3 === 0 ? now - 3 * DAY + (i + 2) * 9 * MINUTE : null,
            },
          ])
        ),
      },
      msg_2: {
        title: 'גרסה 1.21 עלתה',
        body: 'הוספנו הדרכת התקנה חכמה ורמזי הקשר בכל האפליקציה. שווה להציץ.',
        kind: 'info',
        audience: { type: 'all' },
        cta: null,
        createdAt: now - 9 * DAY,
        sendAt: now - 9 * DAY,
        status: 'sent',
        recipients: Object.fromEntries(
          PEOPLE.map(([uid], i) => [
            uid,
            {
              deliveredAt: now - 9 * DAY + 60_000,
              readAt: i % 5 === 0 ? null : now - 9 * DAY + (i + 1) * 21 * MINUTE,
              clickedAt: null,
            },
          ])
        ),
      },
    },
    dm: {
      u_david: {
        dm_1: {
          from: 'user',
          text: 'אפשר לאשר לי את הקנייה מ-#418? מחכה יומיים.',
          sentAt: now - 30 * HOUR,
          readAt: now - 29 * HOUR,
        },
        dm_2: {
          from: 'admin',
          text: 'אושר. תודה שהצפת.',
          sentAt: now - 28 * HOUR,
          readAt: now - 27 * HOUR,
        },
      },
    },
    alertConfig: null,
    alertState: {},
    events: {},
  };

  return { users, rooms, roomCodes, roomNames, feedback, adminConsole };
}

/* ── עותקים מקומיים של מנוע הכספים (src/lib/money.ts) ── */

function splitEqual(total, userIds) {
  const ids = [...new Set(userIds)].sort();
  const base = Math.floor(total / ids.length);
  let remainder = total - base * ids.length;
  const shares = {};
  for (const id of ids) shares[id] = base + (remainder-- > 0 ? 1 : 0);
  return shares;
}

function computeBalances(purchases, settlements, memberIds) {
  const balances = Object.fromEntries(memberIds.map((id) => [id, 0]));
  for (const p of purchases) {
    if (p.status !== 'approved' && p.status !== 'settled') continue;
    balances[p.boughtBy] = (balances[p.boughtBy] ?? 0) + p.amount;
    for (const [uid, share] of Object.entries(p.shares ?? {})) {
      balances[uid] = (balances[uid] ?? 0) - share;
    }
  }
  for (const s of settlements) {
    if (!s.confirmedBy) continue;
    balances[s.from] = (balances[s.from] ?? 0) + s.amount;
    balances[s.to] = (balances[s.to] ?? 0) - s.amount;
  }
  return balances;
}
