import { WEEKDAYS } from '../../lib/format';

/**
 * תרשימים מינימליים ב-CSS בלבד.
 *
 * ‼️ בלי ספריית גרפים: כל מה שהקונסולה צריכה הוא עמודות ופסים, וספריית
 *    תרשימים הייתה מוסיפה ~150KB ותלות שצריך לתחזק בשביל שני מסכים.
 */

export function Bars({
  data,
  labels,
  height = 110,
  highlight,
}: {
  data: number[];
  labels?: string[];
  height?: number;
  highlight?: number;
}) {
  const max = Math.max(1, ...data);
  return (
    <div>
      <div className="bars" style={{ height }}>
        {data.map((value, i) => (
          <div className="bars__col" key={i} title={labels ? `${labels[i]}: ${value}` : String(value)}>
            <div
              className={`bars__bar${highlight !== undefined && highlight !== i ? ' muted' : ''}`}
              style={{ height: `${(value / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      {labels && (
        <div className="bars__labels">
          <span>{labels[0]}</span>
          <span>{labels[Math.floor(labels.length / 2)]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}

export function HBar({
  label,
  value,
  max,
  display,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  display?: string;
  tone?: string;
}) {
  return (
    <div className="hbar">
      <span className="hbar__label truncate" title={label}>
        {label}
      </span>
      <span className="hbar__track">
        <span
          className="hbar__fill"
          style={{
            width: `${max ? Math.max(2, (value / max) * 100) : 0}%`,
            background: tone,
          }}
        />
      </span>
      <span className="hbar__value">{display ?? value}</span>
    </div>
  );
}

/** התפלגות שעות — עונה על "מתי המשתמשים שלי בכלל פעילים". */
export function HourHistogram({ hours, peak }: { hours: number[]; peak?: number }) {
  return (
    <div>
      <Bars
        data={hours}
        labels={hours.map((_, h) => `${h}:00`)}
        height={90}
        highlight={peak}
      />
      <div className="tiny muted" style={{ marginTop: 4 }}>
        שעת שיא: {peak ?? hours.indexOf(Math.max(...hours))}:00
      </div>
    </div>
  );
}

export function WeekdayBars({ weekdays }: { weekdays: number[] }) {
  const max = Math.max(1, ...weekdays);
  return (
    <div>
      {weekdays.map((value, i) => (
        <HBar key={i} label={WEEKDAYS[i]} value={value} max={max} />
      ))}
    </div>
  );
}
