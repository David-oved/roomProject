import { formatILS } from '../../lib/format';

/** פלטת צבעים יציבה — נגזרת מה-uid, כך שהיא זהה בכל מסך ובכל מכשיר. */
const COLORS = [
  '#0d9488', // teal
  '#0284c7', // sky
  '#7c3aed', // violet
  '#d97706', // amber
  '#e11d48', // rose
  '#65a30d', // lime
  '#c026d3', // fuchsia
  '#0891b2', // cyan
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function colorForMember(uid: string): string {
  return COLORS[hashCode(uid) % COLORS.length];
}

interface Slice {
  uid: string;
  name: string;
  value: number;
}

/**
 * תרשים דונאט טהור ב-SVG — כמה אחוזים כל אחד נשא מסך ההוצאות.
 * בלי ספריית תרשימים: זה עיגול אחד עם קטעי stroke-dasharray, ותו לא.
 */
export function ContributionChart({ slices, total }: { slices: Slice[]; total: number }) {
  const R = 60;
  const CIRCUMFERENCE = 2 * Math.PI * R;

  const sorted = [...slices].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);

  let offset = 0;
  const arcs = sorted.map((s) => {
    const fraction = total > 0 ? s.value / total : 0;
    const length = fraction * CIRCUMFERENCE;
    const arc = { ...s, fraction, dashArray: `${length} ${CIRCUMFERENCE - length}`, dashOffset: -offset };
    offset += length;
    return arc;
  });

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        {/* ‼️ aria-hidden: הרשימה שליד הגרף מוסרת בדיוק את אותם נתונים
            בטקסט. בלי זה קורא מסך נכנס לתוך ה-SVG ומקריא רשימת <circle>
            חסרת משמעות לפני שהוא מגיע לנתונים עצמם. */}
        <svg
          width="140"
          height="140"
          viewBox="0 0 140 140"
          className="-rotate-90"
          aria-hidden
          focusable="false"
        >
          <circle cx="70" cy="70" r={R} fill="none" stroke="#f1f2ee" strokeWidth="16" />
          {arcs.map((a) => (
            <circle
              key={a.uid}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={colorForMember(a.uid)}
              strokeWidth="16"
              strokeDasharray={a.dashArray}
              strokeDashoffset={a.dashOffset}
              strokeLinecap="butt"
              className="transition-all duration-500"
            />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="num text-lg font-bold text-ink-900">{formatILS(total)}</p>
            <p className="text-[11px] text-ink-500">סה"כ</p>
          </div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {arcs.map((a) => (
          <li key={a.uid} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorForMember(a.uid) }}
            />
            <span className="min-w-0 flex-1 truncate text-ink-700">{a.name}</span>
            <span className="num shrink-0 font-semibold text-ink-900">
              {Math.round(a.fraction * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
