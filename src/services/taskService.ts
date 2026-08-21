import { push, ref, serverTimestamp, update } from 'firebase/database';
import { db } from '../config/firebase';
import { assertOnline, assertRoomWritable } from './guard';
import { enqueueNotification } from './outboxService';
import type { Category, Task, TaskTransfer, WithId } from '../types/models';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TaskDraft {
  name: string;
  category: Category;
  intervalDays: number;
  /** סדר הסבב — גם מגדיר מי משתתף */
  participants: string[];
}

/** מנהל בלבד — נאכף ב-Rules. תור הסבב מתחיל מהחבר הראשון, ומתחיל "עכשיו". */
export async function createTask(
  code: string,
  adminId: string,
  adminName: string,
  draft: TaskDraft
): Promise<string> {
  assertOnline('להוסיף מטלה');
  assertRoomWritable(code, 'להוסיף מטלה');
  if (draft.participants.length === 0) throw new Error('בחרו לפחות משתתף אחד');

  const name = draft.name.trim();
  const taskId = push(ref(db, `rooms/${code}/tasks`)).key!;
  const notifId = push(ref(db, `rooms/${code}/notifications`)).key!;
  const firstAssignee = draft.participants[0];

  await update(ref(db), {
    [`rooms/${code}/tasks/${taskId}`]: {
      name,
      category: draft.category,
      intervalDays: draft.intervalDays,
      participants: draft.participants,
      currentAssignee: firstAssignee,
      dueAt: serverTimestamp(),
      createdBy: adminId,
      createdAt: serverTimestamp(),
    },
    [`rooms/${code}/notifications/${notifId}`]: {
      type: 'task_added',
      actorId: adminId,
      actorName: adminName,
      text: `נוספה מטלה חדשה: ${name}`,
      entityId: taskId,
      createdAt: serverTimestamp(),
      readBy: { [adminId]: true },
    },
  });

  void enqueueNotification({
    roomCode: code,
    title: 'מטלה חדשה בחדר',
    body: `${name} — נוספה למטלות הקבועות`,
    url: `/r/${code}/tasks`,
    tag: 'tasks',
    priority: 'digest',
    audience: 'room',
    actorUid: adminId,
  });

  return taskId;
}

/** מנהל בלבד — נאכף ב-Rules. */
export async function deleteTask(code: string, taskId: string): Promise<void> {
  assertOnline('למחוק מטלה');
  assertRoomWritable(code, 'למחוק מטלה');
  await update(ref(db), { [`rooms/${code}/tasks/${taskId}`]: null });
}

/**
 * מסמן שהמטלה בוצעה: רושם ביומן ומקדם את התור לחבר הבא ב-participants,
 * החל מהמיקום של מי שמסומן עכשיו כאחראי (גם אם הגיע לשם דרך העברה —
 * הסבב תמיד ממשיך מאיפה שהמטלה נמצאת בפועל, לא ממיקום "מקורי").
 *
 * ‼️ בלי transaction: אם שני מכשירים ילחצו בו-זמנית, הניסיון השני
 * ייכשל בעצמו בכללי ה-DB (currentAssignee כבר לא auth.uid של הלוחץ
 * השני) — הגנה מובנית, לא צריך לבנות אותה שוב בצד לקוח.
 */
export async function completeTask(
  code: string,
  task: WithId<Task>,
  userId: string,
  userName: string
): Promise<void> {
  assertOnline('לסמן מטלה כבוצעה');
  assertRoomWritable(code, 'לסמן מטלה כבוצעה');

  const idx = task.participants.indexOf(task.currentAssignee);
  const nextAssignee = task.participants[(idx + 1) % task.participants.length] ?? task.currentAssignee;
  const nextDueAt = Date.now() + task.intervalDays * DAY_MS;

  const completionId = push(ref(db, `rooms/${code}/taskCompletions`)).key!;
  const notifId = push(ref(db, `rooms/${code}/notifications`)).key!;

  await update(ref(db), {
    [`rooms/${code}/tasks/${task.id}/currentAssignee`]: nextAssignee,
    [`rooms/${code}/tasks/${task.id}/dueAt`]: nextDueAt,
    [`rooms/${code}/taskCompletions/${completionId}`]: {
      taskId: task.id,
      taskName: task.name,
      completedBy: userId,
      completedAt: serverTimestamp(),
    },
    [`rooms/${code}/notifications/${notifId}`]: {
      type: 'task_assigned',
      actorId: userId,
      actorName: userName,
      text: `${userName} השלים/ה את "${task.name}"`,
      entityId: task.id,
      createdAt: serverTimestamp(),
      readBy: { [userId]: true },
    },
  });

  if (nextAssignee !== userId) {
    void enqueueNotification({
      roomCode: code,
      title: 'תורך במטלה',
      body: `${task.name} — התור עבר אליך`,
      url: `/r/${code}/tasks`,
      tag: `task-${task.id}`,
      priority: 'digest',
      audience: 'user',
      targetUid: nextAssignee,
      actorUid: userId,
    });
  }
}

/** בקשה להעביר את התור הנוכחי לחבר אחר — נדרש אישורו. */
export async function requestTaskTransfer(
  code: string,
  task: WithId<Task>,
  fromUid: string,
  fromName: string,
  toUid: string
): Promise<void> {
  assertOnline('לבקש העברת תור');
  assertRoomWritable(code, 'לבקש העברת תור');

  const transferId = push(ref(db, `rooms/${code}/taskTransfers`)).key!;

  await update(ref(db), {
    [`rooms/${code}/taskTransfers/${transferId}`]: {
      taskId: task.id,
      taskName: task.name,
      fromUid,
      toUid,
      status: 'pending',
      createdAt: serverTimestamp(),
      respondedAt: null,
    },
  });

  void enqueueNotification({
    roomCode: code,
    title: 'בקשה להעברת מטלה',
    body: `${fromName} מבקש/ת שתיקח/י את "${task.name}" הפעם`,
    url: `/r/${code}/tasks`,
    tag: `task-transfer-${transferId}`,
    priority: 'now',
    audience: 'user',
    targetUid: toUid,
    actorUid: fromUid,
  });
}

/** תשובה לבקשת העברה — רק toUid יכול, נאכף ב-Rules. */
export async function respondTaskTransfer(
  code: string,
  transfer: WithId<TaskTransfer>,
  responderId: string,
  responderName: string,
  accepted: boolean
): Promise<void> {
  assertOnline('להשיב לבקשת העברה');
  assertRoomWritable(code, 'להשיב לבקשת העברה');

  const updates: Record<string, unknown> = {
    [`rooms/${code}/taskTransfers/${transfer.id}/status`]: accepted ? 'approved' : 'rejected',
    [`rooms/${code}/taskTransfers/${transfer.id}/respondedAt`]: serverTimestamp(),
  };
  if (accepted) {
    updates[`rooms/${code}/tasks/${transfer.taskId}/currentAssignee`] = responderId;
  }

  await update(ref(db), updates);

  void enqueueNotification({
    roomCode: code,
    title: accepted ? 'בקשת ההעברה אושרה' : 'בקשת ההעברה נדחתה',
    body: accepted
      ? `${responderName} ייקח/תיקח את "${transfer.taskName}" הפעם`
      : `${responderName} לא יכול/ה לקחת את "${transfer.taskName}" הפעם`,
    url: `/r/${code}/tasks`,
    tag: `task-transfer-${transfer.id}`,
    priority: 'now',
    audience: 'user',
    targetUid: transfer.fromUid,
    actorUid: responderId,
  });
}
