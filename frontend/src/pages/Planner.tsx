import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { PlannerResponse } from '../types';
import { useStudent } from '../StudentContext';
import { Badge, Card, EmptyState, PageHeader, Spinner } from '../components/ui';

function todayCode() {
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getDay()];
}

export function PlannerPage() {
  const { studentId, student } = useStudent();
  const [data, setData] = useState<PlannerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onlyFree, setOnlyFree] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.portalPlanner(studentId)
      .then(d => { if (alive) { setData(d); setError(''); } })
      .catch(e => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [studentId]);

  const freeWindows = useMemo(() => {
    if (!data) return [];
    return data.days
      .flatMap(d => d.free_blocks.map(b => ({ ...b, day: d.day })))
      .filter(b => b.periods >= 2)
      .sort((a, b) => b.periods - a.periods);
  }, [data]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={30} /></div>;
  if (error || !data) return <Card className="border-[var(--color-danger)]!"><p className="text-sm text-[var(--color-danger)]">{error || 'No planner data.'}</p></Card>;

  const today = todayCode();
  const totalFree = data.days.reduce((sum, d) => sum + d.free_blocks.reduce((s, b) => s + b.periods, 0), 0);
  const examSessions = data.exam_week?.sessions ?? [];

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Planner"
        sub={student ? `${student.group_name} · week at a glance · ${data.workload.weekly_classes} classes` : ''}
        actions={
          <button
            onClick={() => setOnlyFree(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${onlyFree ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent-dim)] text-[var(--color-accent)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'}`}
          >
            {onlyFree ? 'Showing study windows' : 'Show study windows'}
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Weekly classes</div>
          <div className="text-xl font-bold mt-1">{data.workload.weekly_classes}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">{data.workload.weekly_periods} contact periods</div>
        </div>
        <div className="glass p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Busiest day</div>
          <div className="text-xl font-bold mt-1">{data.workload.busiest_day ?? '—'}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">{data.days.find(d => d.day === data.workload.busiest_day)?.class_count ?? 0} classes</div>
        </div>
        <div className="glass p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Earliest start</div>
          <div className="text-xl font-bold mt-1">{data.workload.earliest?.start ?? '—'}</div>
          <div className="text-[10px] text-[var(--color-text-muted)] truncate">{data.workload.earliest?.course_id ?? 'No classes'}</div>
        </div>
        <div className="glass p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Free periods</div>
          <div className="text-xl font-bold text-[var(--color-success)] mt-1">{totalFree}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Across teaching hours</div>
        </div>
      </div>

      {onlyFree ? (
        <Card>
          <h3 className="text-sm font-semibold mb-1">Free study windows</h3>
          <p className="text-[11px] text-[var(--color-text-muted)] mb-4">Contiguous free periods of 2+ hours, largest first. Lunch 13:00–14:00 is not a teaching period.</p>
          {freeWindows.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No two-hour free window this week.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {freeWindows.map((b, i) => (
                <div key={`${b.day}-${b.start_period}-${i}`} className="flex items-center gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]/40 px-3 py-2.5">
                  <div className="w-10 text-center">
                    <div className="text-[9px] text-[var(--color-text-muted)]">{b.day}</div>
                    <div className="text-[10px] font-semibold text-[var(--color-success)]">{b.periods}h</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium">{b.start}–{b.end}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">P{b.start_period}–P{b.end_period}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-2">
          {data.days.map(day => (
            <div key={day.day} className={`rounded-xl border bg-[var(--color-surface-1)] p-2.5 ${day.day === today ? 'border-[var(--color-accent)]/50' : 'border-[var(--color-border)]'}`}>
              <div className="flex items-center justify-between px-1 mb-2">
                <div>
                  <span className="text-xs font-semibold">{day.day}</span>
                  {day.day === today && <span className="ml-1 text-[9px] text-[var(--color-accent)]">today</span>}
                </div>
                <span className="text-[9px] text-[var(--color-text-muted)]">{day.class_count} classes</span>
              </div>

              <div className="space-y-1.5">
                {day.classes.map(c => (
                  <div key={c.session_id} className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]/50 px-2 py-1.5">
                    <div className="flex items-center justify-between text-[9px] text-[var(--color-text-muted)]">
                      <span>{c.start}</span>
                      <span className="uppercase">{c.kind}</span>
                    </div>
                    <div className="text-[11px] font-medium truncate mt-0.5">{c.course_id}</div>
                    <div className="text-[9px] text-[var(--color-text-muted)] truncate">{c.room}</div>
                  </div>
                ))}
                {day.events.map(e => (
                  <div key={e.request_id} className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] px-2 py-1.5">
                    <div className="flex items-center justify-between text-[9px] text-[var(--color-accent)]">
                      <span>{e.start}</span><span>event</span>
                    </div>
                    <div className="text-[10px] font-medium truncate mt-0.5">{e.title}</div>
                    <div className="text-[9px] text-[var(--color-text-muted)] truncate">{e.room}</div>
                  </div>
                ))}
                {day.classes.length === 0 && day.events.length === 0 && (
                  <div className="text-[10px] text-[var(--color-text-muted)] px-1 py-2">Free day</div>
                )}
              </div>

              {day.free_blocks.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)]">
                  <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Free</div>
                  <div className="flex flex-wrap gap-1">
                    {day.free_blocks.map(b => (
                      <span key={`${b.start_period}-${b.end_period}`} className="text-[9px] rounded bg-[var(--color-success-dim)] text-[var(--color-success)] px-1.5 py-0.5">
                        {b.start}–{b.end}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Exam week</h3>
            <Badge variant="info">{data.exams.length} papers for you</Badge>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {examSessions.map(s => (
              <div key={s.id} className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-xs">
                <span className="text-[var(--color-text-muted)]">{s.id}</span> · {s.start}–{s.end}
              </div>
            ))}
            {examSessions.length === 0 && <span className="text-xs text-[var(--color-text-muted)]">Exam week not configured.</span>}
          </div>
          {data.exams.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No exams scheduled for your group.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {data.exams.map(e => (
                <div key={e.exam_id} className="rounded-lg border border-[var(--color-border-subtle)] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium truncate">{e.titles.join(' + ')}</span>
                    <Badge variant={e.session === 'AM' ? 'warning' : 'info'}>{e.session}</Badge>
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{e.day} · {e.start} · {e.rooms.map(r => r.id).join(', ')}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold mb-3">Planning notes</h3>
          <ul className="space-y-2 text-[11px] text-[var(--color-text-muted)]">
            <li>• Free blocks are calculated from your published timetable, not a fixed grid.</li>
            <li>• Fest-week events appear in the day columns when they are approved.</li>
            <li>• Exam rooms are allocated at half capacity; check the exam page for seat plans.</li>
            <li>• Drop a note in Notes with a course tag to keep revision context.</li>
          </ul>
        </Card>
      </div>

      {data.days.every(d => d.classes.length === 0) && (
        <EmptyState icon="◷" title="No classes in the published timetable" sub="Generate and publish a timetable from the admin section first." />
      )}
    </div>
  );
}
