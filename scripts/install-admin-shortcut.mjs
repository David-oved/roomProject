import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ═══════════════════════════════════════════════════════════════
 *  התקנת הקיצור — `npm run admin:shortcut`
 * ═══════════════════════════════════════════════════════════════
 *  יוצר על שולחן העבודה פריט שפתיחתו מריצה את admin/launch.mjs:
 *  השרת עולה (אם אינו חי), נוצר כרטיס כניסה חד-פעמי, והדפדפן נפתח
 *  על קונסולה מחוברת. זהו הקליק הראשון מתוך שניים.
 *
 *  ‼️ הנתיב ל-node נצרב לתוך הקיצור ולא נשען על PATH. פריט שנפתח
 *     מ-Finder או מסייר הקבצים אינו רואה את ה-PATH של הטרמינל, ומי
 *     שמתקין node דרך nvm/fnm היה מקבל „node: command not found”
 *     בלי שום רמז למה.
 *
 *  ‼️ הפלט של המשגר נכתב ללוג ולא למסך: לחיצה על קיצור אינה אמורה
 *     לפתוח חלון טרמינל, וכשמשהו נשבר צריך שיישאר תיעוד.
 * ═══════════════════════════════════════════════════════════════
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const launcher = join(repoRoot, 'admin', 'launch.mjs');
const node = process.execPath;
const logPath = join(repoRoot, 'admin', '.data', 'launch.log');

/** שולחן העבודה — עם שם מתורגם בלינוקס, ועם נפילה חזרה לתיקיית הבית. */
function desktopDir() {
  const home = homedir();
  if (process.platform === 'linux') {
    const probe = spawnSync('xdg-user-dir', ['DESKTOP'], { encoding: 'utf8' });
    const dir = probe.stdout?.trim();
    if (probe.status === 0 && dir && existsSync(dir)) return dir;
  }
  const standard = join(home, 'Desktop');
  if (existsSync(standard)) return standard;
  // OneDrive מעביר את שולחן העבודה בחלק ממחשבי Windows
  const oneDrive = join(home, 'OneDrive', 'Desktop');
  if (existsSync(oneDrive)) return oneDrive;
  return home;
}

const desktop = desktopDir();
const created = [];

if (process.platform === 'darwin') {
  /* חבילת .app ולא סקריפט .command: לחיצה כפולה לא פותחת חלון טרמינל,
     והפריט נראה כמו אפליקציה אמיתית. */
  const app = join(desktop, 'RoomMate Admin.app');
  const macos = join(app, 'Contents', 'MacOS');
  mkdirSync(macos, { recursive: true });

  writeFileSync(
    join(app, 'Contents', 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>RoomMate Admin</string>
  <key>CFBundleIdentifier</key><string>com.roommate.admin.console</string>
  <key>CFBundleExecutable</key><string>roommate-admin</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
`
  );

  const exe = join(macos, 'roommate-admin');
  writeFileSync(
    exe,
    `#!/bin/bash
cd ${JSON.stringify(repoRoot)} || exit 1
exec ${JSON.stringify(node)} ${JSON.stringify(launcher)} >> ${JSON.stringify(logPath)} 2>&1
`
  );
  chmodSync(exe, 0o700);
  created.push(app);
} else if (process.platform === 'win32') {
  const cmd = join(desktop, 'RoomMate Admin.cmd');
  writeFileSync(
    cmd,
    `@echo off\r\ncd /d "${repoRoot}"\r\n"${node}" "${launcher}" >> "${logPath}" 2>&1\r\n`,
    'utf8'
  );
  created.push(cmd);

  /* ‼️ ה-.lnk הוא תוספת ולא תחליף: הוא נפתח ממוזער (WindowStyle 7)
     ולכן חלון ה-cmd לא קופץ. אם PowerShell חסום במדיניות הארגון,
     ה-.cmd לבדו עדיין עובד — ולכן כישלון כאן אינו כישלון ההתקנה. */
  const lnk = join(desktop, 'RoomMate Admin.lnk');
  const ps = [
    '$s = (New-Object -ComObject WScript.Shell).CreateShortcut(' + JSON.stringify(lnk) + ')',
    '$s.TargetPath = ' + JSON.stringify(cmd),
    '$s.WorkingDirectory = ' + JSON.stringify(repoRoot),
    '$s.WindowStyle = 7',
    '$s.Description = "קונסולת המנהל של RoomMate"',
    '$s.Save()',
  ].join('; ');
  const res = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    stdio: 'ignore',
  });
  if (res.status === 0 && existsSync(lnk)) created.push(lnk);
} else {
  // ‼️ הארגומנטים במרכאות: נתיב עם רווח (למשל תיקיית בית עם שם מלא)
  //    היה נקרא כשתי פקודות נפרדות והקיצור פשוט לא היה עובד.
  const entry = `[Desktop Entry]
Type=Application
Name=RoomMate Admin
Name[he]=קונסולת המנהל
Comment=Open the RoomMate admin console
Exec="${node}" "${launcher}"
Path=${repoRoot}
Icon=${join(repoRoot, 'public', 'icons', 'icon-192.png')}
Terminal=false
Categories=Development;Utility;
`;
  const appsDir = join(homedir(), '.local', 'share', 'applications');
  mkdirSync(appsDir, { recursive: true });
  const menuItem = join(appsDir, 'roommate-admin.desktop');
  writeFileSync(menuItem, entry);
  chmodSync(menuItem, 0o755);
  created.push(menuItem);

  const desktopItem = join(desktop, 'roommate-admin.desktop');
  writeFileSync(desktopItem, entry);
  chmodSync(desktopItem, 0o755);
  // ‼️ GNOME מסרב להריץ קיצור שאינו מסומן כאמין, ומציג אותו כקובץ טקסט.
  spawnSync('gio', ['set', desktopItem, 'metadata::trusted', 'true'], { stdio: 'ignore' });
  created.push(desktopItem);
}

console.info('\n🛡️  הקיצור לקונסולת המנהל הותקן:\n');
for (const item of created) console.info(`   • ${item}`);
console.info(`\n   לחיצה עליו מרימה את השרת (אם אינו רץ) ופותחת דפדפן מחובר.`);
console.info(`   הלוג: ${logPath}\n`);
