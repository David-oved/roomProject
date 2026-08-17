/**
 * ללא O, 0, I, 1 — זה קוד שאנשים מכתיבים זה לזה בעל פה.
 * "אפס או או?" היא שיחה שאנחנו רוצים למנוע.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

/** מרחב אפשרויות: 32^6 ≈ 1.07 מיליארד */
export function generateRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes); // ולא Math.random — התנגשויות בפועל
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** מנקה קלט משתמש: "abc-123 " → "ABC123" */
export function sanitizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .replace(new RegExp(`[^${ALPHABET}]`, 'g'), '')
    .slice(0, CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return code.length === CODE_LENGTH && new RegExp(`^[${ALPHABET}]+$`).test(code);
}

/** נרמול שם חדר למפתח ייחודיות: "דירה  12 !" → "דירה-12" */
export function slugifyRoomName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/["'`׳״]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
