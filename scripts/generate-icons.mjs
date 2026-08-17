#!/usr/bin/env node
/**
 * מייצר את אייקוני ה-PWA כקבצי PNG אמיתיים, בלי תלויות חיצוניות.
 *
 * למה בכלל: בלי האייקונים האלה הדפדפן לא מציע להתקין את האפליקציה
 * למסך הבית — וזו הדרך שבה המשתמשים אמורים להשתמש בה.
 *
 *   npm run icons
 *
 * להחלפה בעיצוב אמיתי: פשוט דרסו את הקבצים ב-public/icons/.
 * כלי נוח לכך: https://maskable.app/editor
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

/* ───────── קידוד PNG מינימלי ───────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** rgba: Uint8Array באורך size*size*4 */
function encodePng(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy
      ? rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
      : Buffer.from(rgba).copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ───────── ציור האייקון ───────── */

const BRAND_TOP = [20, 184, 166]; // brand-500
const BRAND_BOTTOM = [15, 118, 110]; // brand-700
const WHITE = [255, 255, 255];

/** ריכוך קצוות: מחזיר 0..1 לפי מרחק מהגבול */
const aa = (d) => Math.max(0, Math.min(1, 0.5 - d));

/**
 * @param size גודל בפיקסלים
 * @param padding שיעור שוליים בטוחים (0.1 רגיל, 0.26 ל-maskable)
 * @param radius רדיוס פינות ביחס לגודל; 0.5 = עיגול מלא
 */
function drawIcon(size, { padding = 0.1, radius = 0.22 } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const inner = size * (1 - padding * 2);
  const x0 = size * padding;
  const y0 = size * padding;
  const r = inner * radius;

  // גיאומטריית הבית, ביחס לריבוע הפנימי
  const hx = x0 + inner * 0.5; // מרכז
  const roofTop = y0 + inner * 0.24;
  const roofBottom = y0 + inner * 0.5;
  const roofHalf = inner * 0.32;
  const bodyTop = roofBottom;
  const bodyBottom = y0 + inner * 0.78;
  const bodyHalf = inner * 0.22;
  const doorHalf = inner * 0.075;
  const doorTop = y0 + inner * 0.6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = x + 0.5;
      const cy = y + 0.5;

      // ── רקע: ריבוע מעוגל עם מדרון אנכי ──
      const dx = Math.max(x0 + r - cx, 0, cx - (x0 + inner - r));
      const dy = Math.max(y0 + r - cy, 0, cy - (y0 + inner - r));
      const dist = Math.hypot(dx, dy) - r;
      const bgAlpha = aa(dist);

      if (bgAlpha <= 0) {
        px[i + 3] = 0;
        continue;
      }

      const t = (cy - y0) / inner;
      let cr = BRAND_TOP[0] + (BRAND_BOTTOM[0] - BRAND_TOP[0]) * t;
      let cg = BRAND_TOP[1] + (BRAND_BOTTOM[1] - BRAND_TOP[1]) * t;
      let cb = BRAND_TOP[2] + (BRAND_BOTTOM[2] - BRAND_TOP[2]) * t;

      // ── הבית בלבן ──
      let houseAlpha = 0;

      // גג: משולש
      if (cy >= roofTop && cy <= roofBottom) {
        const prog = (cy - roofTop) / (roofBottom - roofTop);
        const halfW = roofHalf * prog;
        houseAlpha = Math.max(houseAlpha, aa(Math.abs(cx - hx) - halfW));
      }
      // גוף: מלבן
      if (cy >= bodyTop && cy <= bodyBottom) {
        const inBodyY = Math.min(aa(bodyTop - cy), aa(cy - bodyBottom), 1);
        houseAlpha = Math.max(houseAlpha, Math.min(aa(Math.abs(cx - hx) - bodyHalf), inBodyY));
      }
      // דלת: חיתוך מהגוף
      if (cy >= doorTop && cy <= bodyBottom + 1 && Math.abs(cx - hx) <= doorHalf) {
        houseAlpha = 0;
      }

      const a = Math.min(1, houseAlpha);
      cr = cr + (WHITE[0] - cr) * a;
      cg = cg + (WHITE[1] - cg) * a;
      cb = cb + (WHITE[2] - cb) * a;

      px[i] = Math.round(cr);
      px[i + 1] = Math.round(cg);
      px[i + 2] = Math.round(cb);
      px[i + 3] = Math.round(bgAlpha * 255);
    }
  }

  return encodePng(size, px);
}

/* ───────── כתיבה ───────── */

const targets = [
  { file: 'icon-192.png', size: 192, opts: { padding: 0.06, radius: 0.22 } },
  { file: 'icon-512.png', size: 512, opts: { padding: 0.06, radius: 0.22 } },
  // maskable: אנדרואיד חותך עד 20% מכל צד, לכן שוליים בטוחים גדולים
  { file: 'icon-maskable-512.png', size: 512, opts: { padding: 0.22, radius: 0.5 } },
  // iOS מעגל את הפינות בעצמו — לכן ריבוע מלא
  { file: 'apple-touch-icon-180.png', size: 180, opts: { padding: 0, radius: 0 } },
];

for (const { file, size, opts } of targets) {
  const buf = drawIcon(size, opts);
  writeFileSync(join(outDir, file), buf);
  console.log(`✅ ${file.padEnd(28)} ${size}×${size}  ${(buf.length / 1024).toFixed(1)} KB`);
}

/* ───────── favicon.svg ───────── */

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#0f766e"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <path d="M32 16 L50 33 H44 V48 H36 V38 H28 V48 H20 V33 H14 Z" fill="#fff"/>
</svg>
`;
writeFileSync(join(outDir, '..', 'favicon.svg'), favicon, 'utf8');
console.log('✅ favicon.svg');
