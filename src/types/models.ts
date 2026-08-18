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
export type SplitMethod = 'equal' | 'percentage' | 'custom' | 'covered';
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
}

export interface Settlement {
  from: string;
  to: string;
  amount: Agorot;
  date: number;
  confirmedBy: string | null;
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
  | 'settlement';

export interface AppNotification {
  type: NotificationType;
  actorId: string;
  actorName: string;
  text: string;
  entityId: string | null;
  createdAt: number;
  readBy?: Record<string, true>;
}

/** לכל ישות שנקראת מ-RTDB מתווסף id מהמפתח */
export type WithId<T> = T & { id: string };

/* ═══════════ תוויות לתצוגה ═══════════ */

export const CATEGORY_LABELS: Record<Category, string> = {
  kitchen: 'מטבח',
  bathroom: 'אמבטיה',
  cleaning: 'ניקיון',
  other: 'אחר',
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  kitchen: '🍳',
  bathroom: '🚿',
  cleaning: '🧽',
  other: '📦',
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
