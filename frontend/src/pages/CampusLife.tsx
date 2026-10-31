import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { ClubsResponse, EventsResponse, MessResponse, PortalEvent } from '../types';
import { useStudent } from '../StudentContext';
import { Badge, Card, EmptyState, PageHeader, Spinner } from '../components/ui';

type Tab = 'events' | 'clubs' | 'mess';

const CATEGORY_LABEL: Record<string, string> = {
  institute_event: 'Institute event',
  club_event: 'Club event',
  department_event: 'Department event',
  guest_lecture: 'Guest lecture',
};

function EventCard({ event }: { event: PortalEvent }) {
  return (
    <Card className={event.required_for_you ? 'border-[var(--color-warning)]/40!' : ''}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-3 min-w-0">
          <div className="w-12 shrink-0 rounded-lg bg-[var(--color-accent-dim)] py-2 text-center">
            <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">{event.day}</div>
            <div className="text-[11px] font-semibold text-[var(--color-accent)]">{event.start}</div>
            <div className="text-[9px] text-[var(--color-text-muted)]">{event.end}</div>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-snug">{event.title}</h3>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{event.requester}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant={event.status === 'approved' ? 'success' : 'warning'}>{event.status === 'approved' ? 'Approved' : 'Alternative'}</Badge>
              <Badge>{CATEGORY_LABEL[event.category] ?? event.category}</Badge>
              {event.required_for_you && <Badge variant="warning">Your group</Badge>}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
        <div className="rounded bg-[var(--color-surface-2)] px-2 py-1.5">
          <div className="text-[var(--color-text-muted)]">Venue</div>
          <div className="font-medium truncate">{event.room} · {event.room_id}</div>
        </div>
        <div className="rounded bg-[var(--color-surface-2)] px-2 py-1.5">
          <div className="text-[var(--color-text-muted)]">Expected</div>
          <div className="font-medium">{event.attendance} people</div>
        </div>
      </div>
      {event.needs.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {event.needs.map(n => (
            <span key={n} className="text-[9px] rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[var(--color-text-muted)]">{n}</span>
          ))}
        </div>
      )}
    </Card>
  );
}

export function CampusLifePage() {
  const { studentId } = useStudent();
  const [params, setParams] = useSearchParams();
  const initial = (params.get('tab') as Tab) || 'events';
  const [tab, setTab] = useState<Tab>(['events', 'clubs', 'mess'].includes(initial) ? initial : 'events');
  const [events, setEvents] = useState<EventsResponse | null>(null);
  const [clubs, setClubs] = useState<ClubsResponse | null>(null);
  const [mess, setMess] = useState<MessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([api.portalEvents(studentId), api.portalClubs(), api.portalMess()])
      .then(([e, c, m]) => { if (alive) { setEvents(e); setClubs(c); setMess(m); setError(''); } })
      .catch(e => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [studentId]);

  const changeTab = (next: Tab) => {
    setTab(next);
    setParams({ tab: next }, { replace: true });
  };

  const shownEvents = useMemo(() => {
    if (!events) return [];
    return onlyMine ? events.events.filter(e => e.required_for_you) : events.events;
  }, [events, onlyMine]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={30} /></div>;
  if (error || !events || !clubs || !mess) return <Card className="border-[var(--color-danger)]!"><p className="text-sm text-[var(--color-danger)]">{error || 'No campus data.'}</p></Card>;

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Campus life"
        sub={`${events.fest_week ?? 'Fest week'} · ${events.count} approved events · ${clubs.count} clubs`}
        actions={
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            {(['events', 'clubs', 'mess'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => changeTab(t)}
                className={`px-3 py-1.5 text-xs capitalize ${tab === t ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'}`}
              >{t}</button>
            ))}
          </div>
        }
      />

      {tab === 'events' && (
        <>
          {events.for_you.length > 0 && (
            <div className="rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-dim)] px-4 py-3">
              <div className="text-xs font-semibold text-[var(--color-warning)]">Your group is expected at {events.for_you.length} event{events.for_you.length === 1 ? '' : 's'}</div>
              <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{events.for_you.map(e => e.title).join(' · ')}</div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={() => setOnlyMine(false)} className={`px-3 py-1.5 rounded-lg text-xs ${!onlyMine ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'}`}>All events {events.count}</button>
            <button onClick={() => setOnlyMine(true)} className={`px-3 py-1.5 rounded-lg text-xs ${onlyMine ? 'bg-[var(--color-warning-dim)] text-[var(--color-warning)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'}`}>For my group {events.for_you.length}</button>
          </div>

          {shownEvents.length === 0 ? (
            <EmptyState icon="★" title="No events to show" sub="Only approved and alternative fest-week bookings appear here." />
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {shownEvents.map(e => <EventCard key={e.request_id} event={e} />)}
            </div>
          )}
        </>
      )}

      {tab === 'clubs' && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {clubs.clubs.map(club => (
            <Card key={club.name}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-cyan)] flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {club.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate">{club.name}</h3>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{club.approved} approved · {club.total} requests</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {club.events.slice(0, 3).map(e => (
                  <div key={e.request_id} className="flex items-center gap-2 text-[11px]">
                    <span className="text-[9px] text-[var(--color-text-muted)] w-7">{e.day}</span>
                    <span className="truncate">{e.title}</span>
                    <span className="ml-auto text-[9px] text-[var(--color-text-muted)]">{e.start}</span>
                  </div>
                ))}
                {club.events.length === 0 && <p className="text-[11px] text-[var(--color-text-muted)]">No approved events this fest.</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'mess' && (
        <div className="space-y-4">
          <Card className="border-[var(--color-accent)]/30!">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Today · {mess.today}</h3>
                <p className="text-[10px] text-[var(--color-text-muted)]">Sample menu for the demo</p>
              </div>
              <Badge variant="info">Mess</Badge>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {(['breakfast', 'lunch', 'snacks', 'dinner'] as const).map(meal => (
                <div key={meal} className="rounded-lg bg-[var(--color-surface-2)] p-3">
                  <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">{meal}</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">{mess.menu[meal]}</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-xs min-w-[720px]">
              <thead>
                <tr className="bg-[var(--color-surface-1)] text-left text-[var(--color-text-muted)]">
                  <th className="p-2.5 font-medium w-16">Day</th>
                  <th className="p-2.5 font-medium">Breakfast</th>
                  <th className="p-2.5 font-medium">Lunch</th>
                  <th className="p-2.5 font-medium">Snacks</th>
                  <th className="p-2.5 font-medium">Dinner</th>
                </tr>
              </thead>
              <tbody>
                {mess.days.map(d => (
                  <tr key={d.day} className={`border-t border-[var(--color-border-subtle)] ${d.is_today ? 'bg-[var(--color-accent-dim)]/40' : ''}`}>
                    <td className="p-2.5 font-medium">
                      {d.day}
                      {d.is_today && <span className="ml-1 text-[9px] text-[var(--color-accent)]">today</span>}
                    </td>
                    <td className="p-2.5 text-[var(--color-text-secondary)]">{d.menu.breakfast}</td>
                    <td className="p-2.5 text-[var(--color-text-secondary)]">{d.menu.lunch}</td>
                    <td className="p-2.5 text-[var(--color-text-secondary)]">{d.menu.snacks}</td>
                    <td className="p-2.5 text-[var(--color-text-secondary)]">{d.menu.dinner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
