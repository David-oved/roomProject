/**
 * האם הנתיב הנוכחי הוא אחד משורשי הטאבים (בית / חסרים / חשבון / צ'אט) —
 * המקומות היחידים שבהם סרגל הניווט התחתון אמור להופיע.
 *
 * ‼️ בכוונה השוואה מדויקת (===) ולא startsWith: מסכי-משנה כמו הגדרות,
 * התראות, שיחת צ'אט בודדת, טיול או משימות כן נמצאים תחת /r/:code אבל הם
 * מסכי "צלילה פנימה" ולא טאב פעיל — הסרגל אמור להיעלם בהם (בדיוק כמו
 * ב-tab bar של אפל שמוסתר במסכים שנדחפים מעל טאב). startsWith על "/chat"
 * למשל היה מזהה גם "/chat/general" בטעות כשורש טאב.
 */
export function isRoomTabRoot(pathname: string, code: string | undefined): boolean {
  if (!code) return false;
  const base = `/r/${code}`;
  return (
    pathname === base ||
    pathname === `${base}/items` ||
    pathname === `${base}/balances` ||
    pathname === `${base}/chat`
  );
}
