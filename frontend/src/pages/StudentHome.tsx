import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { PortalHome } from '../types';
import { useStudent } from '../StudentContext';
import { Badge, Button, Card, ProgressBar, Ring, Spinner } from '../components/ui';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function prettyDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function StudentHomePage() {
  const { studentId, student } = useStudent();
  const navigate = useNavigate();
  const [home, setHome] = useState<PortalHome | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.portalHome(studentId)
      .then(d => { if (alive) { setHome(d); setError(''); } })
      .catch(e => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [studentId]);

  if (loading) {
    return <div className="flex items-center justify-center h-72"><Spinner size={32} /></div>;
  }
  if (error || !home) {
    return (
      <Card className="border-[var(--color-danger)]!">
        <p className="text-sm text-[var(--color-danger)]">Could not load your campus dashboard: {error}</p>
        <Button variant="secondary" className="mt-3" onClick={() => window.location.reload()}>Retry</Button>
      </Card>
    );
  }

  const { today, attendance, marks, timetable } = home;
  const next = today.next_class;
  const weekend = !today.is_class_day;
  const displayClasses = weekend ? (today.next_classes ?? []) : today.classes;
  const firstName = home.student.name.split(' ')[0];
  const notifs = home.notifications;
  const weekdayName = new Date(`${today.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  const nextDayName = new Date(`${today.date}T00:00:00`);
  const nextDayLabel = today.next_day
    ? new Date(nextDayName.getTime() + (((['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].indexOf(today.next_day) - nextDayName.getDay() + 7) % 7) || 7) * 86400000)
        .toLocaleDateString('en-US', { weekday: 'long' })
    : '';

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6">
        <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[var(--color-accent)]/20 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-[var(--color-cyan)]/10 blur-2xl" />
        <div className="relative flex flex-col xl:flex-row gap-6 xl:items-center">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse-dot" />
              {home.student.semester_label} · {home.student.group_name}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mt-2">
              {greeting()}, {firstName}.
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">{prettyDate(today.date)}</p>

            <div className="mt-5">
              {weekend ? (
                <>
                  <h3 className="text-xl md:text-2xl font-bold tracking-tight">
                    {weekdayName}. On your terms.
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    {next
                      ? `${nextDayLabel} starts at ${next.start} with ${next.title} in ${next.room}.`
                      : 'No classes on the horizon yet.'}
                  </p>
                </>
              ) : next ? (
                <>
                  <h3 className="text-xl md:text-2xl font-bold tracking-tight">
                    Next: {next.title}
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    {next.start}–{next.end} · {next.room} · {next.faculty}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl md:text-2xl font-bold tracking-tight">You're done for today.</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">No more classes on today's timetable.</p>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-5">
              <Button onClick={() => navigate('/my-timetable')}>Open timetable</Button>
              <Button variant="secondary" onClick={() => navigate('/planner')}>Plan my week</Button>
              <Button variant="ghost" onClick={() => navigate('/attendance')}>Check attendance</Button>
            </div>
          </div>

          <div className="flex items-center gap-5 xl:gap-7">
            <Ring value={attendance.overall_percent} label={`${attendance.overall_percent}%`} sub="Attendance" />
            <div className="space-y-3 min-w-[110px]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Projected SGPA</div>
                <div className="text-xl font-bold text-[var(--color-accent)]">{marks.sgpa.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">CGPA</div>
                <div className="text-xl font-bold">{marks.cgpa.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Credits</div>
                <div className="text-sm font-semibold">{marks.credits}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification strip */}
      {notifs.length > 0 && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {notifs.map(n => (
            <button
              key={n.id}
              onClick={() => navigate(n.href)}
              className="glass px-4 py-3 text-left hover:border-[var(--color-accent)]/40 transition-colors"
            >
              <div className="flex items-start gap-2.5">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                  n.tone === 'warning' ? 'bg-[var(--color-warning)]'
                    : n.tone === 'success' ? 'bg-[var(--color-success)]'
                    : n.tone === 'info' ? 'bg-[var(--color-info)]'
                    : 'bg-[var(--color-accent)]'
                }`} />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-[var(--color-text-primary)] truncate">{n.title}</span>
                  <span className="block text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">{n.detail}</span>
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Today's classes */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">{weekend ? `${nextDayLabel} agenda` : "Today's classes"}</h3>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                {weekend ? 'Your next teaching day' : `${today.classes.length} classes scheduled`}
              </p>
            </div>
            <button onClick={() => navigate('/my-timetable')} className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">
              Full week →
            </button>
          </div>

          {displayClasses.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">No classes scheduled.</div>
          ) : (
            <div className="space-y-2">
              {displayClasses.slice(0, 5).map((c, i) => (
                <div key={`${c.session_id}-${i}`} className="flex items-center gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]/40 px-3 py-2.5">
                  <div className="w-16 shrink-0">
                    <div className="text-xs font-semibold">{c.start}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">{c.end}</div>
                  </div>
                  <div className="w-px self-stretch bg-[var(--color-border)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.title}</div>
                    <div className="text-[11px] text-[var(--color-text-muted)] truncate">
                      {c.room} · {c.faculty}
                    </div>
                  </div>
                  <Badge variant={c.kind === 'lab' ? 'warning' : c.kind === 'tutorial' ? 'success' : 'info'}>
                    {c.kind}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Attendance watchlist */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Attendance watchlist</h3>
            <Badge variant={attendance.below_target > 0 ? 'warning' : 'success'}>
              {attendance.below_target > 0 ? `${attendance.below_target} below` : 'On track'}
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{attendance.overall_percent}%</span>
            <span className="text-[11px] text-[var(--color-text-muted)]">overall · target 75%</span>
          </div>
          <ProgressBar value={attendance.overall_percent} target={75} tone={attendance.overall_percent >= 75 ? 'success' : 'warning'} />
          <div className="mt-4 space-y-3">
            {attendance.watchlist.length === 0 && (
              <p className="text-xs text-[var(--color-text-muted)]">Every subject is above the 75% bar. Keep it up.</p>
            )}
            {attendance.watchlist.map(c => (
              <div key={c.course_id}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="truncate">{c.course_id} · {c.title}</span>
                  <span className={c.percent < 65 ? 'text-[var(--color-danger)]' : 'text-[var(--color-warning)]'}>{c.percent}%</span>
                </div>
                <ProgressBar value={c.percent} target={75} tone={c.percent < 65 ? 'danger' : 'warning'} />
                <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  Attend {c.to_reach} more to reach 75%
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/attendance')} className="mt-4 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">
            Open attendance →
          </button>
        </Card>

        {/* Exams */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Upcoming exams</h3>
            <button onClick={() => navigate('/exams')} className="text-[11px] text-[var(--color-accent)]">All →</button>
          </div>
          {home.exams.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No exams scheduled for your group.</p>
          ) : (
            <div className="space-y-2.5">
              {home.exams.map(e => (
                <div key={e.exam_id} className="rounded-lg border border-[var(--color-border-subtle)] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate">{e.titles.join(' + ')}</span>
                    <Badge variant="info">{e.session}</Badge>
                  </div>
                  <div className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    {e.day} · {e.start}–{e.end} · {e.rooms.map(r => r.name).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Events */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">On campus</h3>
            <button onClick={() => navigate('/campus-life')} className="text-[11px] text-[var(--color-accent)]">All →</button>
          </div>
          {home.events.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No approved fest-week events yet.</p>
          ) : (
            <div className="space-y-2.5">
              {home.events.slice(0, 3).map(e => (
                <div key={e.request_id} className="flex items-start gap-2.5">
                  <div className="w-9 shrink-0 rounded-md bg-[var(--color-accent-dim)] py-1 text-center">
                    <div className="text-[9px] text-[var(--color-text-muted)]">{e.day}</div>
                    <div className="text-[10px] font-semibold text-[var(--color-accent)]">{e.start}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{e.title}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)] truncate">{e.room} · {e.requester}</div>
                    {e.required_for_you && <Badge variant="warning">Your group</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Mess */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">In mess today</h3>
            <button onClick={() => navigate('/campus-life?tab=mess')} className="text-[11px] text-[var(--color-accent)]">Menu →</button>
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] mb-2">{home.mess.day} · sample menu</div>
          <div className="space-y-2">
            {(['lunch', 'snacks', 'dinner'] as const).map(meal => (
              <div key={meal} className="flex items-start gap-2">
                <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] pt-0.5">{meal}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">{home.mess.menu[meal]}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Trust footer */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-4 py-3 text-[11px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${timetable.hard_violations === 0 ? 'bg-[var(--color-success)]' : 'bg-[var(--color-warning)]'}`} />
          {timetable.validated && timetable.hard_violations === 0
            ? 'Schedule verified · 0 hard violations'
            : 'Schedule health not yet verified'}
        </span>
        <span>Timetable v{timetable.version} · {timetable.status}</span>
        {timetable.soft_penalty !== null && <span>Soft penalty {timetable.soft_penalty}</span>}
        <span className="ml-auto">Records marked demo are synthetic; everything else is live solver output.</span>
      </div>
    </div>
  );
}
