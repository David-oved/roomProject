import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { ref, update } from 'firebase/database';
import { db, storage } from '../config/firebase';
import { assertOnline } from './guard';

const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.85;

/**
 * מכווץ תמונה בצד הלקוח לפני העלאה — בלי זה תמונה מהמצלמה (4-12MB)
 * הייתה חוצה את מגבלת ה-2MB בחוקי ה-Storage, ומעלה נתונים כבדים לחינם
 * לתמונת פרופיל שמוצגת ב-40-60px ממילא.
 */
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('לא ניתן לעבד את התמונה'));

      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('כיווץ התמונה נכשל'))),
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('קובץ התמונה לא תקין'));
    };

    img.src = url;
  });
}

/**
 * מעלה תמונת פרופיל ומעדכן אותה בכל מקום שבו היא מופיעה.
 *
 * fan-out: כמו changeDisplayName — התמונה משוכפלת בתוך כל חדר שהמשתמש
 * חבר בו (rooms/{code}/members/{uid}/avatar), כי שם היא מוצגת לחברים
 * האחרים. בלי זה חברי החדר היו ממשיכים לראות את התמונה הישנה.
 */
export async function uploadAvatar(
  userId: string,
  file: File,
  rooms: Record<string, true> | undefined
): Promise<string> {
  assertOnline('להעלות תמונת פרופיל');

  if (!file.type.startsWith('image/')) throw new Error('יש לבחור קובץ תמונה');
  if (file.size > 15 * 1024 * 1024) throw new Error('הקובץ גדול מדי (עד 15MB)');

  const blob = await compressImage(file);

  const path = `avatars/${userId}/${Date.now()}.jpg`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(fileRef);

  const updates: Record<string, unknown> = { [`users/${userId}/avatar`]: url };
  for (const code of Object.keys(rooms ?? {})) {
    updates[`rooms/${code}/members/${userId}/avatar`] = url;
  }
  await update(ref(db), updates);

  return url;
}
