import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi, useAction } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useDict } from '../../lib/store';
import { Avatar, Badge, Card, Empty, Loading, PageHead, Stat, Tabs } from '../ui/primitives';
import { HourHistogram, HBar } from '../ui/charts';
import { UserTimeline } from '../ActivityMonitoring/UserTimeline';
import { UserLocationMap } from '../ActivityMonitoring/UserLocationMap';
import { FeedbackList } from '../FeedbackManagement/FeedbackList';
import { Conversation } from '../MessagingSystem/DirectMessage';
import { ConfirmDialog } from '../ui/Modal';
import { dateOnly, duration, relativeTime, shekels, signedShekels } from '../../lib/format';
import type { DayGroup, FeedbackItem, Template, Thread, UserProfile } from '../../lib/types';

type TabId = 'timeline' | 'rooms' | 'behavior' | 'messages' | 'feedback';

/** תיק משתמש מלא: מי הוא, איפה הוא, מה הוא עושה, ומה נאמר בינינו. */
export function UserDetail() {
  const { uid = '' } = useParams();
  const dict = useDict();
  const [tab, setTab] = useState<TabId>('timeline');
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const { run, busy } = useAction();

  const { data, loading, reload } = useApi<{
    profile: UserProfile;
    timeline: DayGroup[];
    feedback: FeedbackItem[];
    thread: Thread | null;
    suspended: boolean;
  }>(`/users/${uid}`);
  const { data: messagesData } = useApi<{ templates: Template[] }>('/messages');

  if (loading && !data) return <Loading rows={8} />;
  if (!data) return <Empty icon="👻" title="המשתמש לא נמצא" />;

  const { profile, timeline, feedback, suspended } = data;
  const w = profile.window;

  const featureEntries = Object.entries(w.features).sort((a, b) => b[1] - a[1]);
  const maxFeature = Math.max(1, ...featureEntries.map(([, v]) => v));

  const toggleSuspend = () =>
    run(
      () => api.post(`/users/${uid}/action`, { action: suspended ? 'unsuspend' : 'suspend' }),
      suspended ? 'ההשעיה בוטלה' : 'המשתמש הושעה'
    ).then(() => {
      setConfirmSuspend(false);
      reload();
    });

  return (
    <>
      <PageHead
        title={profile.displayName}
        subtitle={
          <>
            {profile.email} · נרשם {dateOnly(profile.createdAt)} · פעיל {relativeTime(profile.lastActiveAt)}
            {suspended && <Badge tone="danger"> מושעה</Badge>}
          </>
        }
        actions={
          <>
            <Link className="btn" to="/users">
              → כל המשתמשים
            </Link>
            <Link className="btn primary" to={`/messages?tab=direct&uid=${uid}`}>
              ✉️ שליחת הודעה
            </Link>
            <button className={`btn ${suspended ? '' : 'danger'}`} onClick={() => setConfirmSuspend(true)}>
              {suspended ? 'ביטול השעיה' : 'השעיה'}
            </button>
          </>
        }
      />

      <div className="row wrap mb" style={{ gap: 6 }}>
        <Avatar name={profile.displayName} size="lg" />
        <div className="row wrap" style={{ gap: 6, marginInlineStart: 8 }}>
          {profile.segments.map((segment) => {
            const meta = dict?.segments?.[segment];
            return (
              <Badge key={segment} tone={(meta?.tone as never) ?? 'neutral'}>
                {meta?.label ?? segment}
              </Badge>
            );
          })}
        </div>
      </div>

      <div className="grid cols-6 mb">
        <Stat label="חדרים" value={profile.roomsCount} hint={`${profile.memberships.length} חברויות בסך הכול`} />
        <Stat label="פעולות ב-30 יום" value={w.actions} hint={`${w.actionsPerWeek} בשבוע`} />
        <Stat label="ימים פעילים" value={`${w.activeDays}/${w.days}`} hint={`${w.activeDayRatio}% מהתקופה`} />
        <Stat label="סשן ממוצע" value={duration(w.avgSessionMs)} small hint={`${w.sessions} סשנים (הערכה)`} />
        <Stat label="סך קניות" value={shekels(profile.stats.totalSpent)} small hint={`${profile.stats.purchasesMade} קניות`} />
        <Stat
          label="מאזן כולל"
          value={signedShekels(profile.stats.netBalance)}
          small
          tone={profile.stats.netBalance < 0 ? 'danger' : 'success'}
          hint={profile.stats.netBalance < 0 ? 'חייב כסף' : 'מגיע לו כסף'}
        />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'timeline', label: 'ציר זמן' },
          { id: 'rooms', label: 'חדרים', count: profile.memberships.length },
          { id: 'behavior', label: 'התנהגות' },
          { id: 'messages', label: 'שיחה' },
          { id: 'feedback', label: 'משוב', count: feedback.length },
        ]}
      />

      {tab === 'timeline' && (
        <Card title="כל הפעולות" subtitle="נגזר מהנתונים עצמם — לא מיומן חיצוני">
          <UserTimeline groups={timeline} />
        </Card>
      )}

      {tab === 'rooms' && (
        <Card title="חברות בחדרים" tight>
          <UserLocationMap memberships={profile.memberships} />
        </Card>
      )}

      {tab === 'behavior' && (
        <div className="grid side">
          <Card title="שימוש בפיצ׳רים" subtitle="לפי פעולות בפועל בחלון של 30 יום">
            {!featureEntries.length ? (
              <Empty icon="📉" title="אין פעילות בחלון הנוכחי" />
            ) : (
              featureEntries.map(([feature, count]) => (
                <HBar key={feature} label={feature} value={count} max={maxFeature} />
              ))
            )}
            <div className="divider" />
            <div className="row wrap" style={{ gap: 22 }}>
              <span>
                דיווחים: <span className="bold">{w.reported}</span>
              </span>
              <span>
                קניות: <span className="bold">{w.bought}</span>
              </span>
              <span>
                יחס דיווח:קנייה{' '}
                <span className="bold">
                  {w.bought === 0 ? (w.reported ? 'מדווח ולא קונה' : '—') : `${Math.round(w.reportToBuyRatio * 10) / 10}:1`}
                </span>
              </span>
              <span>
                מטלות שביצע: <span className="bold">{profile.stats.tasksCompleted}</span>
              </span>
            </div>
          </Card>

          <Card title="מתי הוא פעיל" subtitle="התפלגות שעות ביממה">
            <HourHistogram hours={w.hours} />
          </Card>
        </div>
      )}

      {tab === 'messages' && <Conversation uid={uid} templates={messagesData?.templates ?? []} />}

      {tab === 'feedback' && (
        <Card title="משוב שנשלח" tight>
          {feedback.length ? <FeedbackList items={feedback} /> : <Empty icon="💬" title="המשתמש לא שלח משוב" />}
        </Card>
      )}

      {confirmSuspend && (
        <ConfirmDialog
          title={suspended ? 'ביטול השעיה?' : 'השעיית משתמש?'}
          danger={!suspended}
          busy={busy}
          confirmLabel={suspended ? 'בטל השעיה' : 'השעה'}
          message={
            suspended
              ? `${profile.displayName} יוכל להתחבר שוב לאפליקציה.`
              : `${profile.displayName} לא יוכל להתחבר לאפליקציה עד לביטול ההשעיה. הנתונים והחברויות שלו נשמרים במלואם.`
          }
          onCancel={() => setConfirmSuspend(false)}
          onConfirm={toggleSuspend}
        />
      )}
    </>
  );
}
