import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Faculty, TimetableAssignment, TimetableResponse } from '../types';
import { DAYS, PERIODS } from '../types';
import { useStudent } from '../StudentContext';
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui';

const TIME_SLOTS: Record<number, string> = {
  1: '08:00', 2: '09:00', 3: '10:00', 4: '11:00', 5: '12:00',
  6: '14:00', 7: '15:00', 8: '16:00', 9: '17:00',
};

const KIND_STYLES: Record<string, string> = {
  lecture: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200',
  tutorial: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  lab: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  seminar: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200',
};

function todayCode() {
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getDay()];
}

export function MyTimetablePage() {
  const { studentId, student } = useStudent();
  const [tt, setTt] = useState<TimetableResponse | null>(null);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<TimetableAssignment | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([api.timetable({ group_id: student?.group_id }), api.faculty()])
      .then(([t, f]) => { if (alive) { setTt(t); setFaculty(f); setError(''); } })
      .catch(e => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [studentId, student?.group_id]);

  const facultyMap = useMemo(() => Object.fromEntries(faculty.map(f => [f.id, f.name])), [faculty]);
  const grid = useMemo(() => {
    const map: Record<string, Record<number, TimetableAssignment[]>> = {};
    for (const day of DAYS) {
      map[day] = {};
      for (const p of PERIODS) map[day][p] = [];
    }
    for (const a of tt?.assignments ?? []) {
      const duration = a.duration ?? 1;
      for (let p = a.start_period; p < a.start_period + duration; p++) {
        if (map[a.day]?.[p]) map[a.day][p].push(a);
      }
    }
    return map;
  }, [tt]);

  const weekly = useMemo(() => {
    const ids = new Set<string>();
    let periods = 0;
    for (const a of tt?.assignments ?? []) {
      ids.add(a.session_id);
      periods += a.duration ?? 1;
    }
    return { classes: ids.size, periods };
  }, [tt]);

  const today = todayCode();
  const todayAssignments = today in grid ? (tt?.assignments ?? []).filter(a => a.day === today) : [];

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={30} /></div>;

  if (error) {
    return (
      <Card className="border-[var(--color-danger)]!">
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
        <Button variant="secondary" className="mt-3" onClick={() => window.location.reload()}>Retry</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="My timetable"
        sub={student ? `${student.group_name} · ${student.program} · Semester ${student.semester}` : ''}
        actions={
          <>
            <Badge variant="success">v{tt?.version ?? 0} · {tt?.status ?? 'n/a'}</Badge>
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={`px-3 py-1.5 text-xs ${view === 'grid' ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
              >Grid</button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 text-xs ${view === 'list' ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
              >List</button>
            </div>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Weekly classes</div>
          <div className="text-xl font-bold mt-1">{weekly.classes}</div>
        </div>
        <div className="glass p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Contact hours</div>
          <div className="text-xl font-bold mt-1">{weekly.periods}</div>
        </div>
        <div className="glass p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Group strength</div>
          <div className="text-xl font-bold mt-1">{student?.group_size ?? '—'}</div>
        </div>
        <div className="glass p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Today</div>
          <div className="text-xl font-bold mt-1">{todayAssignments.length} <span className="text-xs font-normal text-[var(--color-text-muted)]">classes</span></div>
        </div>
      </div>

      {!tt || tt.assignments.length === 0 ? (
        <EmptyState icon="▦" title="No timetable published for your group" sub="Ask the scheduling office to publish a timetable." />
      ) : view === 'grid' ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full table-fixed border-collapse text-xs min-w-[880px]">
            <thead>
              <tr className="bg-[var(--color-surface-1)]">
                <th className="p-2 text-left text-[var(--color-text-muted)] font-medium w-20">Time</th>
                {DAYS.map(d => (
                  <th key={d} className={`p-2 text-center font-medium ${d === today ? 'text-[var(--color-accent)] bg-[var(--color-accent-dim)]' : 'text-[var(--color-text-muted)]'}`}>
                    {d}
                    {d === today && <span className="ml-1 text-[9px]">●</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(p => (
                <Fragment key={p}>
                  <tr>
                    <td className="p-2 align-top border-t border-[var(--color-border-subtle)]">
                      <div className="font-mono text-[var(--color-text-secondary)]">P{p}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{TIME_SLOTS[p]}</div>
                    </td>
                    {DAYS.map(d => {
                      const cells = grid[d]?.[p] ?? [];
                      return (
                        <td key={`${d}-${p}`} className={`p-1 align-top border-t border-[var(--color-border-subtle)] ${d === today ? 'bg-[var(--color-accent-dim)]/30' : ''}`}>
                          <div className="space-y-1">
                            {cells.map(a => (
                              <button
                                key={`${a.session_id}-${p}`}
                                onClick={() => setSelected(a)}
                                className={`w-full text-left rounded-md border px-2 py-1.5 transition-transform hover:scale-[1.02] ${KIND_STYLES[a.kind ?? ''] ?? 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]'}`}
                              >
                                <div className="font-semibold truncate">{a.course_id}</div>
                                <div className="opacity-75 truncate text-[10px]">{a.room_name ?? a.room_id}</div>
                              </button>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  {p === 5 && (
                    <tr>
                      <td className="p-2 text-[10px] text-[var(--color-text-muted)]">13:00</td>
                      <td colSpan={5} className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] bg-[var(--color-surface-1)]">
                        Lunch break · 13:00–14:00
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {DAYS.map(d => {
            const rows = (tt.assignments ?? []).filter(a => a.day === d).sort((a, b) => a.start_period - b.start_period);
            return (
              <Card key={d} className={d === today ? 'border-[var(--color-accent)]/50!' : ''}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{d}{d === today ? ' · Today' : ''}</h3>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{rows.length} classes</span>
                </div>
                {rows.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] py-3">Free day.</p>
                ) : (
                  <div className="space-y-2">
                    {rows.map(a => (
                      <button key={a.session_id} onClick={() => setSelected(a)} className="w-full text-left flex gap-2.5 rounded-lg border border-[var(--color-border-subtle)] px-2.5 py-2 hover:bg-[var(--color-surface-2)]">
                        <div className="w-10 shrink-0 text-[10px] font-mono text-[var(--color-text-muted)] pt-0.5">P{a.start_period}</div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">{a.course_id} · {a.kind}</div>
                          <div className="text-[10px] text-[var(--color-text-muted)] truncate">{a.room_name} · {facultyMap[a.faculty_id ?? ''] ?? a.faculty_id}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-[11px] text-[var(--color-text-muted)]">
        {Object.keys(KIND_STYLES).map(k => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded border ${KIND_STYLES[k]}`} />
            {k}
          </span>
        ))}
      </div>

      {selected && (
        <Card className="border-[var(--color-accent)]/40!">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{selected.course_id} · {selected.kind}</h3>
                <Badge variant="info">{selected.day} P{selected.start_period}{selected.duration && selected.duration > 1 ? `–P${selected.start_period + selected.duration - 1}` : ''}</Badge>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {selected.room_name ?? selected.room_id} · {facultyMap[selected.faculty_id ?? ''] ?? selected.faculty_id ?? 'Faculty TBA'}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                Groups: {selected.groups?.join(', ') || '—'} · {selected.size ?? '—'} students · {selected.session_id}
              </p>
            </div>
            <button onClick={() => setSelected(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm">✕</button>
          </div>
        </Card>
      )}
    </div>
  );
}
