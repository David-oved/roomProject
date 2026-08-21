/**
 * טיפוסי התשובות של ה-API.
 *
 * ‼️ מוגדרים כאן ולא מיובאים מהשרת (שהוא JS רגיל) — הקובץ הזה הוא
 *    *החוזה* של הממשק מול השרת. אם הם יוצאים מסנכרון, TypeScript
 *    מתלונן במסך שמשתמש בשדה, וזה בדיוק המקום שבו רוצים לגלות.
 */

export type Severity = 'info' | 'warn' | 'critical';
export type Tone = 'info' | 'success' | 'warn' | 'danger' | 'neutral';

export interface Dict {
  label: string;
  icon?: string;
  tone?: Tone;
  hint?: string;
  description?: string;
  weight?: number;
}

export interface ActivityEvent {
  id: string;
  ts: number;
  category: string;
  type: string;
  roomCode: string | null;
  roomName?: string | null;
  actorId: string | null;
  actorName?: string | null;
  text: string;
  detail?: string | null;
  amount?: number;
  status?: string | null;
  entityId?: string | null;
  severity: Severity;
  sensitive?: string;
}

export interface Membership {
  roomCode: string;
  roomName: string;
  role: 'admin' | 'member';
  status: 'active' | 'removed' | 'pending';
  joinedAt: number;
  balance: number;
  borne: number;
  paidOut: number;
}

export interface UserStats {
  itemsReported: number;
  purchasesMade: number;
  purchasesPending: number;
  totalSpent: number;
  totalBorne: number;
  tasksCompleted: number;
  chatMessages: number;
  approvals: number;
  netBalance: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  avatar: string | null;
  createdAt: number;
  lastActiveAt: number;
  daysSinceActive: number;
  memberships: Membership[];
  roomsCount: number;
  stats: UserStats;
  segments: string[];
  window: {
    days: number;
    actions: number;
    actionsPerWeek: number;
    activeDays: number;
    activeDayRatio: number;
    sessions: number;
    avgSessionMs: number;
    hours: number[];
    weekdays: number[];
    features: Record<string, number>;
    reported: number;
    bought: number;
    reportToBuyRatio: number;
  };
}

export interface RoomIssue {
  severity: Severity;
  code: string;
  title: string;
  detail: string | null;
  action: string | null;
}

export interface RoomHealth {
  code: string;
  name: string;
  score: number;
  level: 'healthy' | 'risk' | 'critical';
  issues: RoomIssue[];
  adminId: string | null;
  adminName: string;
  membersActive: number;
  membersTotal: number;
  membersInactive: number;
  pendingRequests: number;
  openItems: number;
  oldestOpenItemDays: number | null;
  pendingPurchases: number;
  spread: number;
  totalSpent: number;
  lastActivityAt: number;
  idleDays: number | null;
  createdAt: number;
}

export interface FeedbackItem {
  id: string;
  type: string;
  typeLabel: string;
  subject: string;
  body: string;
  environment: Record<string, string> | null;
  attachments: Array<{ name: string; size: number }>;
  createdAt: number;
  roomCode: string | null;
  roomName: string | null;
  userId: string | null;
  userName: string;
  userRole: string;
  status: string;
  priority: string;
  category: string;
  assignee: string | null;
  notes: Array<{ id: string; text: string; createdAt: number }>;
  responses: Array<{ id: string; text: string; sentAt: number }>;
  timeline: Array<{ id: string; text: string; actor: string; at: number }>;
  duplicates: Array<{ id: string; subject: string; roomName: string | null }>;
  updatedAt: number;
}

export interface FeedbackCounts {
  total: number;
  new: number;
  open: number;
  resolved: number;
  archived: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface Audience {
  type: 'all' | 'room' | 'users' | 'active' | 'inactive' | 'admins' | 'segment';
  roomCode?: string;
  uids?: string[];
  segment?: string;
}

export interface AdminMessage {
  id: string;
  title: string;
  body: string;
  kind: string;
  audience: Audience;
  cta: { text: string; url: string } | null;
  recurrence: string | null;
  createdAt: number;
  sendAt: number;
  status: 'sent' | 'scheduled' | 'draft';
  recipientCount: number;
  readCount: number;
}

export interface MessageTracking {
  recipients: Array<{
    uid: string;
    name: string;
    deliveredAt: number | null;
    readAt: number | null;
    clickedAt: number | null;
    failed: boolean;
    timeToReadMs: number | null;
  }>;
  stats: {
    sent: number;
    delivered: number;
    read: number;
    clicked: number;
    failed: number;
    pending: number;
    deliveredPercent: number;
    readPercent: number;
    clickPercent: number;
    engagementPercent: number;
    avgTimeToReadMs: number;
    fastestMs: number;
    slowestMs: number;
  };
  byRoom: Array<{ code: string; name: string; total: number; read: number }>;
}

export interface Template {
  id: string;
  name: string;
  title: string;
  body: string;
  kind: string;
  createdAt: number;
}

export interface DmMessage {
  id: string;
  from: 'admin' | 'user';
  text: string;
  sentAt: number;
  readAt: number | null;
  adminReadAt?: number | null;
  relatedFeedback?: string;
}

export interface Thread {
  uid: string;
  name: string;
  lastActiveAt: number;
  online: boolean;
  messages: DmMessage[];
  lastMessage: DmMessage | null;
  unread: number;
}

export interface Alert {
  id: string;
  trigger: string;
  severity: Severity;
  category: 'room' | 'user' | 'feedback' | 'system';
  title: string;
  detail?: string | null;
  roomCode?: string | null;
  userId?: string | null;
  entityId?: string | null;
  action?: string | null;
  firstSeenAt: number;
  dismissed: boolean;
  acknowledged: boolean;
  isNew: boolean;
}

export interface AlertConfig {
  triggers: Record<string, { enabled: boolean; severity: Severity; label: string }>;
  delivery: {
    desktop: boolean;
    sound: boolean;
    email: boolean;
    emailAddress: string;
    badge: boolean;
  };
  quietHours: { enabled: boolean; from: string; to: string; criticalOnly: boolean };
  thresholds: { unusualActionsPerHour: number; dormantDays: number };
}

export interface Analytics {
  windowDays: number;
  totals: {
    users: number;
    activeNow: number;
    activePercent: number;
    newUsers: number;
    newUsersDelta: number;
    churned: number;
    churnPercent: number;
    rooms: number;
    avgRoomsPerUser: number;
    avgSessionMs: number;
    sessionsPerUserPerWeek: number;
  };
  peakHour: number;
  peakWeekday: number;
  hours: number[];
  weekdays: number[];
  featureUsage: Array<{ feature: string; users: number; percent: number }>;
  daily: Array<{ date: string; actions: number; users: number }>;
  bySegment: Record<string, string[]>;
  profileSummaries: Array<{
    uid: string;
    displayName: string;
    actions: number;
    actionsPerWeek: number;
    activeDays: number;
    avgSessionMs: number;
    roomsCount: number;
    segments: string[];
    daysSinceActive: number;
    totalSpent: number;
    reported: number;
    bought: number;
  }>;
}

export interface Report {
  type: string;
  title: string;
  period: { from: number; to: number; days: number };
  cards: Array<{ label: string; value: string | number }>;
  tables: Array<{ title: string; columns: string[]; rows: Array<Array<string | number>> }>;
}

export interface Bootstrap {
  version: number;
  mode: 'live' | 'demo';
  missing: string[];
  now: number;
  counts: {
    users: number;
    rooms: number;
    alerts: number;
    criticalAlerts: number;
    feedbackNew: number;
    unreadThreads: number;
  };
  rooms: Array<{ code: string; name: string }>;
  users: Array<{ uid: string; name: string; email: string }>;
  dictionaries: {
    eventCategories: Record<string, Dict>;
    feedbackTypes: Record<string, Dict>;
    feedbackStatuses: Record<string, Dict>;
    priorities: Record<string, Dict>;
    messageKinds: Record<string, Dict>;
    audienceTypes: Record<string, string>;
    segments: Record<string, Dict>;
    reportTypes: Record<string, Dict>;
    healthThresholds: Record<string, number>;
  };
  quietHours: boolean;
}

export interface Overview {
  cards: Record<string, number>;
  daily: Array<{ date: string; actions: number; users: number }>;
  topAlerts: Alert[];
  worstRooms: RoomHealth[];
  recentEvents: ActivityEvent[];
  latestFeedback: FeedbackItem[];
}

export interface RoomDetail {
  health: RoomHealth;
  room: {
    code: string;
    name: string;
    description: string;
    adminId: string | null;
    adminName: string;
    createdAt: number;
    lastActivityAt: number;
    totalSpent: number;
    spread: number;
    archivedAt: number | null;
  };
  members: Array<{
    uid: string;
    name: string;
    email: string;
    role: string;
    status: string;
    joinedAt: number;
    balance: number;
    lastActiveAt: number;
  }>;
  contributors: Array<{
    uid: string;
    name: string;
    role: string;
    balance: number;
    borne: number;
    paidOut: number;
    reported: number;
    bought: number;
    tasks: number;
    ratio: number | null;
  }>;
  openItems: Array<{
    id: string;
    name: string;
    category: string;
    reportedBy: string;
    reportedAt: number;
    priority: string;
    status: string;
  }>;
  pendingPurchases: Array<{
    id: string;
    title: string;
    boughtBy: string;
    amount: number;
    createdAt: number;
    date: number;
  }>;
  pendingRequests: Array<{
    userId: string;
    displayName: string;
    email: string;
    requestedAt: number;
  }>;
  balances: Record<string, number>;
  tasks: Array<{ id: string; name: string; currentAssignee: string; dueAt: number; intervalDays: number }>;
  feedback: FeedbackItem[];
  log: Array<{ date: string; events: ActivityEvent[] }>;
}

export interface DayGroup {
  date: string;
  events: ActivityEvent[];
}
