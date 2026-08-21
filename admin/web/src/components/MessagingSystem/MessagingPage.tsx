import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { Loading, PageHead, Tabs } from '../ui/primitives';
import { BroadcastComposer } from './BroadcastComposer';
import { MessageHistory } from './MessageTracking';
import { TemplateManager } from './TemplateManager';
import { DirectMessages } from './DirectMessage';
import type { AdminMessage, Template } from '../../lib/types';

type TabId = 'compose' | 'history' | 'direct' | 'templates';

/** מרכז ההודעות — שידורים, מעקב, שיחות אישיות ותבניות. */
export function MessagingPage() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<TabId>((params.get('tab') as TabId) ?? (params.get('uid') ? 'direct' : 'compose'));
  const { data, loading, reload } = useApi<{ messages: AdminMessage[]; templates: Template[] }>('/messages');

  const scheduled = data?.messages.filter((m) => m.status === 'scheduled').length ?? 0;

  return (
    <>
      <PageHead
        title="הודעות"
        subtitle="שידור לכולם, לחדר או למשתמש בודד — עם מעקב קריאה מלא"
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'compose', label: 'הודעה חדשה' },
          { id: 'history', label: 'היסטוריה ומעקב', count: data?.messages.length },
          { id: 'direct', label: 'שיחות אישיות' },
          { id: 'templates', label: 'תבניות', count: data?.templates.length },
        ]}
      />

      {scheduled > 0 && tab !== 'history' && (
        <div className="card mb">
          <div className="card__body small">
            ⏳ {scheduled} הודעות ממתינות לשליחה מתוזמנת. הן יישלחו גם אם הקונסולה סגורה? לא — השרת המקומי
            חייב לרוץ. זה המחיר של כלי שרץ אצלי על המחשב ולא בענן.
          </div>
        </div>
      )}

      {loading && !data ? (
        <Loading rows={6} />
      ) : tab === 'compose' ? (
        <BroadcastComposer templates={data?.templates ?? []} onSent={reload} />
      ) : tab === 'history' ? (
        <MessageHistory messages={data?.messages ?? []} onChanged={reload} />
      ) : tab === 'direct' ? (
        <DirectMessages initialUid={params.get('uid') ?? undefined} templates={data?.templates ?? []} />
      ) : (
        <TemplateManager templates={data?.templates ?? []} onChanged={reload} />
      )}
    </>
  );
}
