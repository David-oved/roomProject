import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
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
 *     מ-Finder אינו רואה את ה-PATH של הטרמינל, ומי שמתקין node דרך
 *     nvm/fnm היה מקבל „node: command not found” בלי שום רמז למה.
 *
 *  ‼️ הפלט של המשגר נכתב ללוג ולא למסך: לחיצה על קיצור אינה אמורה
 *     לפתוח חלון טרמינל, וכשמשהו נשבר צריך שיישאר תיעוד.
 * ═══════════════════════════════════════════════════════════════
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const adminDir = join(repoRoot, 'admin');
const launcher = join(adminDir, 'launch.mjs');
const node = process.execPath;
const logPath = join(adminDir, '.data', 'launch.log');
mkdirSync(join(adminDir, '.data'), { recursive: true });

/**
 * מריץ סקריפט PowerShell מקובץ ולא מ--Command.
 *
 * ‼️ עם BOM ובקידוד UTF-8: PowerShell 5.1 (מה שמותקן בברירת מחדל
 *    ב-Windows) קורא קובץ בלי BOM לפי קידוד המערכת, וכל נתיב עברי
 *    בתוכו הופך לג׳יבריש. זו בדיוק הסביבה שבה המשתמש הזה עובד —
 *    „C:\\Users\\…\\OneDrive\\שולחן העבודה”.
 */
function runPowerShell(script) {
  const file = join(tmpdir(), `roommate-shortcut-${process.pid}.ps1`);
  writeFileSync(file, '\uFEFF' + script, 'utf8');
  return spawnSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file],
    { encoding: 'utf8' }
  );
}

/**
 * שולחן העבודה.
 *
 * ‼️ לא `~/Desktop`. ב-Windows התיקייה מתורגמת („שולחן העבודה”) וגם
 *    מועברת ל-OneDrive, ולכן היחיד שיודע איפה היא באמת הוא ה-API של
 *    מערכת ההפעלה. בלינוקס אותו סיפור עם xdg-user-dir.
 */
function desktopDir() {
  const home = homedir();

  if (process.platform === 'win32') {
    const probe = runPowerShell(
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n' +
        '[Environment]::GetFolderPath("Desktop")\n'
    );
    const dir = probe.stdout?.trim();
    if (probe.status === 0 && dir && existsSync(dir)) return dir;
  }

  if (process.platform === 'linux') {
    const probe = spawnSync('xdg-user-dir', ['DESKTOP'], { encoding: 'utf8' });
    const dir = probe.stdout?.trim();
    if (probe.status === 0 && dir && existsSync(dir)) return dir;
  }

  for (const candidate of [join(home, 'Desktop'), join(home, 'OneDrive', 'Desktop')]) {
    if (existsSync(candidate)) return candidate;
  }
  return home;
}

const desktop = desktopDir();
const created = [];
const notes = [];

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
  /**
   * המשגר יושב **בתוך הפרויקט** ומוצא את עצמו דרך %~dp0.
   *
   * ‼️ הסיבה אינה סגנון: cmd.exe קורא קובץ אצווה בקידוד ה-OEM של
   *    המסוף (862/437), לא UTF-8. נתיב עברי שכתוב כטקסט בתוך .cmd
   *    היה נשבר — ובדיוק כך נראה נתיב שיושב תחת „שולחן העבודה”.
   *    %~dp0 מורחב על ידי cmd מהמערכת עצמה ולכן חסין.
   */
  const repoCmd = join(adminDir, 'launch.cmd');
  writeFileSync(
    repoCmd,
    [
      '@echo off',
      // ‼️ chcp לפני כל שורה שיש בה תו לא-אנגלי — כולל ההערה הבאה.
      //    cmd.exe מפענח שורה-שורה לפי קידוד המסוף הנוכחי.
      'chcp 65001 >nul',
      'rem משגר קונסולת המנהל — נוצר על ידי npm run admin:shortcut',
      'cd /d "%~dp0.."',
      `set "NODE_EXE=${node}"`,
      // ‼️ נפילה חזרה ל-PATH: מי שיעדכן גרסת node ימצא נתיב צרוב שלא קיים.
      'if not exist "%NODE_EXE%" set "NODE_EXE=node"',
      'if not exist "%~dp0.data" mkdir "%~dp0.data"',
      '"%NODE_EXE%" "%~dp0launch.mjs" >> "%~dp0.data\\launch.log" 2>&1',
      '',
    ].join('\r\n'),
    'utf8'
  );
  created.push(repoCmd);

  /* ‼️ ה-.lnk נכתב על ידי Windows עצמו (COM) ולכן נתיבים בעברית בו
     תקינים תמיד. WindowStyle 7 = ממוזער, כדי שחלון ה-cmd לא יקפוץ. */
  const lnk = join(desktop, 'RoomMate Admin.lnk');
  const res = runPowerShell(
    [
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      '$s = (New-Object -ComObject WScript.Shell).CreateShortcut(' + JSON.stringify(lnk) + ')',
      '$s.TargetPath = ' + JSON.stringify(repoCmd),
      '$s.WorkingDirectory = ' + JSON.stringify(repoRoot),
      '$s.WindowStyle = 7',
      '$s.Description = "קונסולת המנהל של RoomMate"',
      '$s.Save()',
      '',
    ].join('\n')
  );

  if (res.status === 0 && existsSync(lnk)) {
    created.push(lnk);
  } else {
    notes.push(
      'לא הצלחתי ליצור קיצור על שולחן העבודה (PowerShell חסום?).',
      `גררו ידנית את ${repoCmd} לשולחן העבודה, או צרו לו קיצור.`
    );
  }
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
if (notes.length) {
  console.info('');
  for (const note of notes) console.info(`   ⚠️  ${note}`);
}
console.info(`\n   לחיצה עליו מרימה את השרת (אם אינו רץ) ופותחת דפדפן מחובר.`);
console.info(`   הלוג: ${logPath}`);

/**
 * ‼️ אזהרת OneDrive. `admin/.data/token` הוא אישור גישה, ו-
 *    `service-account.json` עוקף את כל ה-Security Rules. פרויקט
 *    שיושב בתוך תיקייה מסונכרנת מעלה את שניהם לענן — כלומר הסוד
 *    שאמור לא לעזוב את המחשב, עוזב אותו.
 */
if (/[\\/](OneDrive|Dropbox|Google Drive|iCloud)/i.test(repoRoot)) {
  console.info(
    `\n   ⚠️  הפרויקט יושב בתיקייה מסונכרנת לענן.\n` +
      `      admin/.data (הטוקן) ו-admin/service-account.json הם סודות שאסור שיעלו לענן.\n` +
      `      הגדירו ADMIN_DATA_DIR לתיקייה מקומית מחוץ לסנכרון — ראו admin/README.md.`
  );
}
console.info('');
