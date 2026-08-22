export type Category = 'kitchen' | 'bathroom' | 'cleaning' | 'other';
export type Priority = 'high' | 'normal' | 'low';
export type ItemStatus = 'needed' | 'buying' | 'bought' | 'done';
export type PurchaseStatus = 'pending' | 'approved' | 'rejected' | 'settled';
/**
 * 'covered' = "לקחתי על עצמי".
 * הקנייה נרשמת ונראית לכולם, אבל אף אחד לא מחויב. מודל של מעקב
 * תרומות במקום מעקב חובות — מתאים לקניות קטנות ותכופות, שבהן
 * ההתחשבנות עצמה יקרה יותר מהסכום.
 */
export type SplitMethod = 'equal' | 'percentage' | 'custom' | 'covered' | 'offset';
export type MemberRole = 'admin' | 'member';
export type MemberStatus = 'active' | 'removed';

/** ‼️ סכומים תמיד באגורות (מספר שלם). ₪12.34 → 1234 */
export type Agorot = number;

export interface UserProfile {
  email: string;
  displayName: string;
  avatar: string | null;
  createdAt: number;
  lastActiveAt?: number;
  rooms?: Record<string, true>;
}

export interface RoomMetadata {
  name: string;
  description: string;
  photo: string | null;
  categories: Partial<Record<Category, true>>;
  currency: 'ILS';
  createdAt: number;
  createdBy: string;
  adminId: string;
  /**
   * חדר שאורכב על ידי מנהל המערכת מקונסולת הניהול.
   * הנתונים נשמרים במלואם — מה שנחסם הוא כתיבה חדשה בלבד.
   * ראו docs/13-admin-console.md.
   */
  archivedAt?: number;
}

export interface Member {
  name: string;
  email: string;
  avatar: string | null;
  joinedAt: number;
  status: MemberStatus;
  role: MemberRole;
}

export interface Item {
  name: string;
  nameLower: string;
  category: Category;
  reportedBy: string;
  reportedAt: number;
  priority: Priority;
  status: ItemStatus;
  assignedTo: string | null;
  notes: string | null;
  purchaseId: string | null;
  /** מזהה המוצר בקטלוג, אם הפריט דווח ממנו */
  productId?: string | null;
}

export interface Purchase {
  itemId: string | null;
  title: string;
  boughtBy: string;
  amount: Agorot;
  date: number;
  createdAt: number;
  splitMethod: SplitMethod;
  splitBetween: Record<string, true>;
  shares: Record<string, Agorot>;
  receipt: string | null;
  status: PurchaseStatus;
  approvedBy: string | null;
  note?: string;
  /** הקנייה נוצרה מסיום קנייה גדולה — ראו Trip */
  tripId?: string;
}

export interface Settlement {
  from: string;
  to: string;
  amount: Agorot;
  date: number;
  confirmedBy: string | null;
  /**
   * החוב הזה מקורו בקנייה גדולה שהתחלקה בין כל החדר. תשלום כזה לא
   * נסגר באישור נושה יחיד — ראו approvals ו-isSettlementSettled ב-money.ts.
   */
  tripId?: string;
  /** הצבעות אישור לתשלום שמקורו בקנייה גדולה: מנהל או רוב חברים פעילים */
  approvals?: Record<string, true>;
}

export type TripStatus = 'planning' | 'shopping' | 'done' | 'cancelled';
export type TripLineState = 'planned' | 'bought' | 'not_found';

/**
 * שורה ברשימת הקנייה הגדולה. itemId מקשר למוצר חסר קיים בחדר
 * (ראו Item) — לא כל שורה מקושרת: אפשר להוסיף מוצר לרשימה בלי
 * שקדם לו דיווח "חסר".
 */
export interface TripLine {
  name: string;
  category: Category;
  qty: number;
  productId?: string | null;
  itemId?: string | null;
  state: TripLineState;
  addedBy: string;
  addedAt: number;
}

/**
 * קנייה גדולה — סבב קניות מרוכז אחד, מרשימה משותפת ועד סגירה בקנייה
 * יחידה שמתחלקת שווה בשווה בין החברים הפעילים.
 *
 * ‼️ רק קנייה אחת פעילה בכל רגע בחדר — נאכף ע"י rooms/{code}/activeTripId,
 * שנתפס אטומית באותו דפוס בדיוק כמו ייחודיות שם חדר (ראו roomService).
 */
export interface Trip {
  status: TripStatus;
  title: string;
  createdBy: string;
  createdAt: number;
  /** מי יצא בפועל לסופר. רק הוא יכול לסיים את הקנייה. */
  shopperId: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  receiptTotal: Agorot | null;
  /** הקנייה שנוצרה עם הסיום */
  purchaseId: string | null;
  cancelledBy?: string;
}

/**
 * הודעת צ'אט — משמשת גם לצ'אט הכללי (rooms/{code}/chat) וגם לצ'אט
 * הפרטי (dms/{code}/{pairKey}/messages), אותו מבנה בדיוק.
 *
 * deliveredTo/readBy הם מפות uid→true, בדיוק כמו readBy בהתראות —
 * כל צד מסמן את עצמו, אף פעם לא מסמן עבור מישהו אחר.
 */
export interface ChatMessage {
  senderId: string;
  text: string;
  sentAt: number;
  deliveredTo?: Record<string, true>;
  readBy?: Record<string, true>;
}

/**
 * מטלה קבועה — סבב אוטומטי בין participants.
 *
 * ‼️ אין currentIndex נפרד — currentAssignee הוא תמיד ה-uid שאחראי
 * *בפועל* כרגע (גם אחרי העברה). כשמסמנים "בוצע", הבא בתפקיד נגזר
 * מהמיקום של currentAssignee בתוך participants — כך שהרוטציה תמיד
 * ממשיכה מאיפה שהמטלה נמצאת עכשיו, בלי צורך במונה נפרד.
 */
export interface Task {
  name: string;
  category: Category;
  /** כל כמה ימים המטלה חוזרת */
  intervalDays: number;
  /** סדר הסבב הקבוע — גם מגדיר מי משתתף */
  participants: string[];
  /** מי אחראי כרגע בפועל */
  currentAssignee: string;
  dueAt: number;
  createdBy: string;
  createdAt: number;
}

/** יומן ביצוע — מקור האמת להוגנות ("מי עשה כמה"), בדיוק כמו purchases לכסף */
export interface TaskCompletion {
  taskId: string;
  taskName: string;
  completedBy: string;
  completedAt: number;
}

export type TaskTransferStatus = 'pending' | 'approved' | 'rejected';

/** בקשת העברת תור במטלה בין שני משתתפים */
export interface TaskTransfer {
  taskId: string;
  taskName: string;
  fromUid: string;
  toUid: string;
  status: TaskTransferStatus;
  createdAt: number;
  respondedAt: number | null;
}

/** הודעת שידור מהמנהל — רק המנהל כותב, כל החברים קוראים */
export interface Announcement {
  senderId: string;
  text: string;
  sentAt: number;
  /**
   * שידור שהגיע ממנהל *המערכת* (קונסולת הניהול) ולא ממנהל החדר.
   * מוצג עם תג נפרד — חבר שחושב שמנהל החדר כתב את זה עלול להשיב
   * לאדם הלא נכון, או להתעלם מהודעה מערכתית שחשוב שיקרא.
   */
  fromSystemAdmin?: boolean;
}

export interface JoinRequest {
  userId: string;
  displayName: string;
  email: string;
  avatar: string | null;
  requestedAt: number;
  status: 'pending' | 'approved' | 'rejected';
  respondedAt: number | null;
}

export type NotificationType =
  | 'item_added'
  | 'item_claimed'
  | 'item_bought'
  | 'purchase_made'
  | 'purchase_approved'
  | 'purchase_rejected'
  | 'member_joined'
  | 'member_removed'
  | 'settlement'
  | 'task_added'
  | 'task_assigned'
  | 'task_transfer';

export interface AppNotification {
  type: NotificationType;
  actorId: string;
  actorName: string;
  text: string;
  entityId: string | null;
  createdAt: number;
  readBy?: Record<string, true>;
}

/* ═══════════ הערוץ מול מנהל המערכת ═══════════ */
/*
 * שלושת הצמתים הבאים הם החוזה מול קונסולת הניהול המקומית.
 * המבנה המלא, כולל מי כותב לכל שדה, מתועד ב-docs/13-admin-console.md.
 */

export type FeedbackType = 'bug' | 'feature' | 'issue' | 'question' | 'compliment' | 'other';

/**
 * משוב שנשלח מהאפליקציה למנהל המערכת.
 *
 * ‼️ הרשומה נעולה אחרי היצירה: אין עריכה ואין מחיקה מהלקוח. הסטטוס,
 *    העדיפות והתשובה של המנהל נשמרים בצומת נפרד שהלקוח אינו רואה —
 *    כך שמה שכתוב כאן הוא תמיד מה שהמשתמש עצמו כתב.
 */
export interface Feedback {
  roomCode: string;
  userId: string;
  type: FeedbackType;
  /** 3–80 תווים */
  subject: string;
  /** עד 2000 תווים */
  body: string;
  createdAt: number;
  /** פרטי המכשיר — מה שהופך "לא עובד" לדיווח שאפשר לשחזר */
  environment?: Record<string, string>;
  attachments?: Array<{ name: string; size: number; url?: string }>;
}

export type AdminMessageKind = 'info' | 'success' | 'warning' | 'error' | 'maintenance';

/**
 * הודעה מהמנהל בתיבה האישית: שידור כללי, הודעה אישית או תשובה למשוב.
 * המשתמש כותב כאן שני שדות בלבד — readAt ו-clickedAt.
 */
export interface AdminMessage {
  title: string;
  body: string;
  kind: AdminMessageKind;
  cta?: { text: string; url: string } | null;
  sentAt: number;
  readAt: number | null;
  clickedAt?: number | null;
  /** מזהה המשוב שההודעה הזו עונה עליו, אם היא תשובה */
  relatedFeedback?: string;
}

/** חסימת משתמש. קיים = חסום. הלקוח קורא בלבד. */
export interface Suspension {
  at: number;
  reason: string | null;
}

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'משהו לא עובד',
  feature: 'רעיון לשיפור',
  issue: 'בעיה בחדר',
  question: 'שאלה',
  compliment: 'מחמאה',
  other: 'אחר',
};

/** לכל ישות שנקראת מ-RTDB מתווסף id מהמפתח */
export type WithId<T> = T & { id: string };

/* ═══════════ תוויות לתצוגה ═══════════ */

export const CATEGORY_LABELS: Record<Category, string> = {
  kitchen: 'מטבח',
  bathroom: 'אמבטיה',
  cleaning: 'ניקיון',
  other: 'אחר',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'דחוף',
  normal: 'רגיל',
  low: 'לא דחוף',
};

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  needed: 'חסר',
  buying: 'בקנייה',
  bought: 'נקנה',
  done: 'הושלם',
};

export const SPLIT_METHOD_LABELS: Record<SplitMethod, string> = {
  covered: 'לקחתי על עצמי',
  offset: 'קיזוז מהחוב',
  equal: 'שווה בשווה',
  percentage: 'לפי אחוזים',
  custom: 'סכום ידני',
};

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending: 'ממתין לאישור',
  approved: 'אושר',
  rejected: 'נדחה',
  settled: 'סגור',
};

export const ALL_CATEGORIES: Category[] = ['kitchen', 'bathroom', 'cleaning', 'other'];

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  planning: 'בבנייה',
  shopping: 'בסופר',
  done: 'הושלמה',
  cancelled: 'בוטלה',
};
